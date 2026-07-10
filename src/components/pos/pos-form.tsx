'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchMedicines, clearQueryCaches } from '@/lib/queries';
import { createClient } from '@/utils/supabase/client';
import { generateInvoiceNumber } from '@/lib/utils';
import { ArrowLeft, Plus, Save, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { coerceNumber } from '@/lib/numeric-field';
import { toast } from 'sonner';
import { useDistinctValues } from '@/hooks/use-distinct-values';
import { useUserProfile } from '@/contexts/user-profile-context';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import { CustomerHeaderCard, type CustomerHeaderData } from '@/components/pos/customer-header-card';
import { SalesItemCard, type SalesItem } from '@/components/pos/sales-item-card';

const InvoicePDFWrapper = dynamic(
  () => import('@/components/invoice/invoice-pdf-wrapper').then((mod) => mod.InvoicePDFWrapper),
  { ssr: false }
);

interface POSFormProps {
  initialData?: any;
}

export function POSForm({ initialData }: POSFormProps) {
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();

  const customerNames = useDistinctValues('customers', 'name', false);
  const customerPhones = useDistinctValues('sales_invoices', 'customer_phone');
  const doctorNames = useDistinctValues('sales_invoices', 'doctor_name');
  const areas = useDistinctValues('sales_invoices', 'area');

  const [medicines, setMedicines] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);

  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number | string>(
    initialData ? initialData.discountPercent : 0
  );

  const [customerData, setCustomerData] = useState<CustomerHeaderData>({
    customerName: initialData ? initialData.customerName || '' : '',
    customerPhone: initialData ? initialData.customerPhone || '' : '',
    doctorName: initialData ? initialData.doctorName || '' : '',
    area: initialData ? initialData.area || '' : '',
    total: initialData ? initialData.total || 0 : 0,
  });

  const getInitialItems = (): SalesItem[] => {
    if (initialData && initialData.items && initialData.items.length > 0) {
      return initialData.items.map((i: any) => {
        const g = i.medicine?.global_medicine_master;
        const gmm = Array.isArray(g) ? g[0] : g;
        return {
        medicineId: i.store_inventory_id,
        medicineName: gmm?.name || '',
        storeInventoryBatchId: i.store_inventory_batch_id,
        batchNumber: i.batch?.batch_number || '',
        expiryDate: i.expiryDate || '',
        mrp: i.mrp || 0,
        quantity: i.quantity || 1,
        gstPercent: i.gstPercent || 12,
        packSize: gmm?.pack_size || '',
        unitsPerPack: gmm?.units_per_pack || 1,
        totalAmount: (i.quantity || 0) * (i.mrp || 0)
      };
      });
    }
    return [{
      medicineId: '', medicineName: '', storeInventoryBatchId: '',
      batchNumber: '', expiryDate: '', mrp: 0, quantity: 1, gstPercent: 12, totalAmount: 0
    }];
  };

  const [items, setItems] = useState<SalesItem[]>(getInitialItems());

  useEffect(() => {
    if (profileLoading) return;

    let cancelled = false;

    async function fetchData() {
      try {
        const medData = await fetchMedicines();
        if (cancelled) return;
        setMedicines(medData);
        if (profile?.store) {
          setStoreSettings(profile.store);
        }
      } catch (error) {
        console.error('Failed to fetch POS data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [profile, profileLoading]);

  const handleItemChange = (idx: number, field: keyof SalesItem, value: any, fullItem?: any) => {
    const newItems = [...items];
    (newItems[idx] as any)[field] = value;
    
    // Auto-fill from global master when selecting medicine
    if (field === 'medicineName' && fullItem) {
      newItems[idx].medicineId = fullItem.id;
      newItems[idx].packSize = fullItem.packSize || '';
      newItems[idx].unitsPerPack = fullItem.unitsPerPack || 1;
      if (fullItem.gstPercent !== undefined) newItems[idx].gstPercent = fullItem.gstPercent;
      
      // Auto-select oldest available batch if any
      const availableBatches = fullItem.batches?.filter((b: any) => b.quantity > 0).sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()) || [];
      if (availableBatches.length > 0) {
        const oldest = availableBatches[0];
        newItems[idx].storeInventoryBatchId = oldest.id;
        newItems[idx].batchNumber = oldest.batchNumber;
        newItems[idx].expiryDate = oldest.expiryDate;
        newItems[idx].mrp = oldest.mrp;
      } else {
        newItems[idx].storeInventoryBatchId = '';
        newItems[idx].batchNumber = '';
        newItems[idx].expiryDate = '';
        newItems[idx].mrp = 0;
      }
    }
    
    // Auto-calculate total amount
    if (['quantity', 'mrp', 'storeInventoryBatchId'].includes(field) || field === 'medicineName') {
       const qty = coerceNumber(newItems[idx].quantity);
       const mrp = newItems[idx].mrp || 0;
       newItems[idx].totalAmount = Number((qty * mrp).toFixed(2));
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      medicineId: '', medicineName: '', storeInventoryBatchId: '',
      batchNumber: '', expiryDate: '', mrp: 0, quantity: 1, gstPercent: 12, totalAmount: 0
    }]);
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const calculateTotals = () => {
    let subtotal = 0, gstAmount = 0;
    items.forEach(item => {
       if (!item.storeInventoryBatchId) return; // Skip invalid items
       const itemTotal = coerceNumber(item.quantity) * (item.mrp || 0);
       subtotal += itemTotal;
       
       // Reverse calculate base price from MRP (MRP is inclusive of GST usually)
       // This matches original POS math:
       const basePrice = itemTotal / (1 + (coerceNumber(item.gstPercent, 12) / 100));
       gstAmount += (itemTotal - basePrice);
    });
    
    const currentDiscount = typeof globalDiscountPercent === 'number' ? globalDiscountPercent : parseFloat(globalDiscountPercent) || 0;
    const discountAmount = subtotal * (currentDiscount / 100);
    const total = subtotal - discountAmount;
    
    return { subtotal, discountAmount, gstAmount, total };
  };

  const totals = calculateTotals();

  const handleCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    // Validate
    const validItems = items.filter(i => i.storeInventoryBatchId && coerceNumber(i.quantity) > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item');
      return;
    }

    for (const item of validItems) {
      const med = medicines.find((m) => m.id === item.medicineId);
      const batch = med?.batches?.find((b: any) => b.id === item.storeInventoryBatchId);
      const qty = coerceNumber(item.quantity);
      if (batch && qty > batch.quantity) {
        toast.error(`Only ${batch.quantity} units available for ${item.medicineName}`);
        return;
      }
    }

    setIsSaving(true);

    try {
        if (!profile?.store_id) throw new Error("Store ID not found");

        const invoiceData = {
            invoiceNumber: initialData ? initialData.invoiceNumber : generateInvoiceNumber(),
            customerName: customerData.customerName.trim() || 'Walk-in Customer',
            customerPhone: customerData.customerPhone.trim(),
            doctorName: customerData.doctorName.trim() || 'WALK-IN',
            area: customerData.area.trim() || 'LOCAL',
            subtotal: totals.subtotal,
            gstAmount: totals.gstAmount,
            discountPercent: typeof globalDiscountPercent === 'number' ? globalDiscountPercent : parseFloat(globalDiscountPercent) || 0,
            discountAmount: totals.discountAmount,
            total: totals.total,
        };

        const supabase = createClient();
        
        const itemsPayload = validItems.map(item => ({
            ...item,
            batchId: item.storeInventoryBatchId
        }));

        const rpcName = initialData ? 'update_sales_invoice' : 'save_sales_invoice';
        const payload: any = {
            invoice_data: { ...invoiceData, storeId: profile.store_id },
            items: itemsPayload,
        };

        if (initialData) {
            payload.p_invoice_id = initialData.id;
        }

        const { data: result, error } = await supabase.rpc(rpcName, payload);
        
        if (error) throw error;
        
        setLastInvoiceId(result?.id || result);
        setIsSuccess(true);
        clearQueryCaches();
        toast.success(initialData ? 'Sale updated successfully' : 'Sale completed successfully');
        
    } catch (error: any) {
        console.error('Checkout failed:', error);
        toast.error(error.message || 'Checkout failed. Please try again.');
    } finally {
        setIsSaving(false);
    }
  };

  const startNewSale = () => {
    if (initialData) {
       router.push('/pos/new');
       return;
    }
    setItems([{
      medicineId: '', medicineName: '', storeInventoryBatchId: '',
      batchNumber: '', expiryDate: '', mrp: 0, quantity: 1, gstPercent: 12, totalAmount: 0
    }]);
    setCustomerData({
      customerName: '',
      customerPhone: '',
      doctorName: '',
      area: '',
      total: 0,
    });
    setGlobalDiscountPercent(0);
    setIsSuccess(false);
    setLastInvoiceId(null);
  };



  if (loading || profileLoading) {
    return (
      <div className="container py-4 flex flex-col gap-4 animate-pulse">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (isSuccess) {
      return (
          <div className="container min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center p-4">
              <div className="text-emerald-500 bg-emerald-500/10 p-4 rounded-full ring-4 ring-emerald-500/5 animate-bounce">
                <CheckCircle2 size={48} />
              </div>
              <div className="grid gap-1">
                <h2 className="text-xl font-extrabold tracking-tight">Sale {initialData ? 'Updated' : 'Completed'}!</h2>
                <p className="text-sm text-muted-foreground font-medium">Inventory updated and invoice generated.</p>
              </div>
              
              <div className="flex flex-col gap-2 w-full max-w-sm">
                  <InvoicePDFWrapper 
                    invoiceId={lastInvoiceId} 
                    size="lg" 
                    className="w-full h-11 text-base font-bold shadow-lg shadow-primary/20" 
                  />
                  <Button variant="outline" size="lg" className="w-full h-10" onClick={startNewSale}>
                    New Sale
                  </Button>
                  <Button render={<Link href="/pos" />} variant="ghost" size="lg" className="w-full h-10">
                    Back to Sales List
                  </Button>
              </div>
          </div>
      );
  }

  return (
    <div className="container py-4 flex flex-col gap-4 pb-[360px] sm:pb-28">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/pos" />} className="rounded-full">
            <ArrowLeft size={24} />
        </Button>
        <h1 className="text-lg font-bold tracking-tight">{initialData ? 'Edit Sale' : 'Point of Sale'}</h1>
      </header>

      <form onSubmit={handleCheckout} className="flex flex-col gap-4">
        {/* ─── Customer Header ─── */}
        <CustomerHeaderCard
          data={{ ...customerData, total: totals.total }}
          onChange={(field, value) => setCustomerData({ ...customerData, [field]: value })}
          customerNames={customerNames}
          customerPhones={customerPhones}
          doctorNames={doctorNames}
          areas={areas}
        />

        {/* ─── Items Section ─── */}
        <div className="flex justify-between items-center">
           <h2 className="text-xl font-bold tracking-tight">Line Items</h2>
           <Button type="button" onClick={addItem} variant="outline" size="sm" className="rounded-full font-bold">
               <Plus size={16} className="mr-2" /> Add Item
           </Button>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
             <SalesItemCard
               key={idx}
               item={item}
               index={idx}
               onChange={handleItemChange}
               onRemove={removeItem}
               medicines={medicines}
               canRemove={items.length > 1}
             />
          ))}
        </div>

        {/* ─── Bottom Action Bar ─── */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/90 backdrop-blur-xl border-t border-border z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
           <div className="container max-w-6xl flex flex-col sm:flex-row justify-between items-center gap-3">
              
              {/* Discount Controls */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Global Disc:</span>
                {[0, 5, 10].map(d => (
                    <Button key={d} type="button" variant={globalDiscountPercent === d ? 'default' : 'outline'} size="sm" className="h-8 px-2" onClick={() => setGlobalDiscountPercent(d)}>{d}%</Button>
                ))}
                <div className="relative w-20">
                  <Input 
                    type="number" 
                    value={globalDiscountPercent} 
                    onChange={(e) => setGlobalDiscountPercent(e.target.value)} 
                    className="h-8 pr-6 text-sm"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                </div>
              </div>

              {/* Totals */}
              <div className="flex gap-4 sm:gap-6 font-bold w-full sm:w-auto justify-between sm:justify-center items-center">
                 <div className="flex flex-col"><span className="text-[9px] text-muted-foreground uppercase tracking-widest">Subtotal</span>₹{totals.subtotal.toFixed(2)}</div>
                 <div className="flex flex-col text-rose-500"><span className="text-[9px] text-muted-foreground uppercase tracking-widest">Discount</span>-₹{totals.discountAmount.toFixed(2)}</div>
                 <div className="flex flex-col text-primary text-xl items-end sm:items-start"><span className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none mb-0.5">Net Total</span><span className="leading-none">₹{totals.total.toFixed(2)}</span></div>
              </div>

              {/* Checkout Button */}
              <Button 
                 type="submit"
                 className="w-full sm:w-auto h-12 sm:h-11 px-6 text-base font-bold rounded-xl shadow-lg shadow-primary/15 flex gap-2 shrink-0 transition-transform active:scale-[0.98]"
                 disabled={isSaving}
              >
                 {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                 {isSaving ? (initialData ? 'Updating...' : 'Processing...') : (initialData ? `Update (${items.filter(i => i.storeInventoryBatchId).length} items)` : `Checkout (${items.filter(i => i.storeInventoryBatchId).length} items)`)}
              </Button>
           </div>
        </div>
      </form>
    </div>
  );
}
