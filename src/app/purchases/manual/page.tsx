'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { fetchUserProfile, fetchMedicines } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Save, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useDistinctValues } from '@/hooks/use-distinct-values';
import { toast } from 'sonner';

// ─── Shared Components ────────────────────────────────────────
import { InvoiceHeaderCard, type InvoiceHeaderData } from '@/components/purchases/invoice-header-card';
import { PurchaseItemCard, type PurchaseItem } from '@/components/purchases/purchase-item-card';

export default function ManualPurchaseEntry() {
  const router = useRouter();
  const distributors = useDistinctValues('purchase_invoices', 'distributor_name');
  const manufacturers = useDistinctValues('manufacturers', 'name', true);

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoiceData, setInvoiceData] = useState<InvoiceHeaderData>({
    distributorName: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    total: 0,
  });

  const [items, setItems] = useState<PurchaseItem[]>([
    {
      medicineName: '', category: '', manufacturer: '',
      batchNumber: '', expiryDate: '', quantity: 1, freeQuantity: 0,
      purchasePrice: 0, mrp: 0, discountPercent: 0, gstPercent: 12, totalAmount: 0
    }
  ]);

  const [medicines, setMedicines] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    fetchMedicines().then(setMedicines);
    
    const draft = sessionStorage.getItem('manual_purchase_draft');
    if (draft) {
       try {
         const data = JSON.parse(draft);
         if (data.invoiceData) setInvoiceData(data.invoiceData);
         if (data.items) setItems(data.items);
       } catch(e) {}
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      sessionStorage.setItem('manual_purchase_draft', JSON.stringify({ invoiceData, items }));
    }
  }, [invoiceData, items, isClient]);

  // ─── Item Change Handler ─────────────────────────────────────
  const handleItemChange = (idx: number, field: keyof PurchaseItem, value: any, fullItem?: any) => {
    const newItems = [...items];
    (newItems[idx] as any)[field] = value;
    
    // Auto-fill from global master if available
    if (field === 'medicineName' && fullItem) {
      if (fullItem.gstPercent !== undefined) newItems[idx].gstPercent = fullItem.gstPercent;
      if (fullItem.manufacturer !== undefined) newItems[idx].manufacturer = fullItem.manufacturer;
      if (fullItem.hsnCode !== undefined) newItems[idx].hsnCode = fullItem.hsnCode;
      if (fullItem.category !== undefined) newItems[idx].category = fullItem.category;
    }
    
    // Auto-calculate total amount
    if (['quantity', 'purchasePrice', 'discountPercent', 'gstPercent'].includes(field)) {
       const qty = field === 'quantity' ? value : newItems[idx].quantity || 0;
       const price = field === 'purchasePrice' ? value : newItems[idx].purchasePrice || 0;
       const disc = field === 'discountPercent' ? value : newItems[idx].discountPercent || 0;
       const gst = field === 'gstPercent' ? value : newItems[idx].gstPercent || 0;
       
       const base = qty * price;
       const afterDisc = base - (base * (disc / 100));
       const finalTotal = afterDisc + (afterDisc * (gst / 100));
       newItems[idx].totalAmount = Number(finalTotal.toFixed(2));
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      medicineName: '', category: '', manufacturer: '',
      batchNumber: '', expiryDate: '', quantity: 1, freeQuantity: 0,
      purchasePrice: 0, mrp: 0, discountPercent: 0, gstPercent: 12, totalAmount: 0
    }]);
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const calculateTotals = () => {
    let subtotal = 0, discountAmount = 0, gstAmount = 0, total = 0;
    items.forEach(item => {
       const base = item.quantity * item.purchasePrice;
       const disc = base * ((item.discountPercent || 0) / 100);
       const afterDisc = base - disc;
       const gst = afterDisc * ((item.gstPercent || 0) / 100);
       subtotal += base;
       discountAmount += disc;
       gstAmount += gst;
       total += (afterDisc + gst);
    });
    return { subtotal, discountAmount, gstAmount, total };
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!invoiceData.distributorName || !invoiceData.invoiceNumber) return;
    setError(null);
    setIsSaving(true);

    try {
      const totals = calculateTotals();
      const formattedItems = items.map(item => {
         const [mm, yyyy] = item.expiryDate.split('-');
         return { ...item, expiryDate: `${yyyy}-${mm}` };
      });

      const finalData = {
        ...invoiceData,
        ...totals,
        items: formattedItems
      };

      const profile = await fetchUserProfile();
      if (!profile?.store_id) throw new Error("Store ID not found");

      const supabase = createClient();
      const { error } = await supabase.rpc('save_purchase_invoice', {
        purchase_data: { ...finalData, storeId: profile.store_id },
        items: formattedItems,
      });

      if (error) {
        // Handle duplicate invoice error from the DB-level guard
        if (error.message?.includes('DUPLICATE_INVOICE')) {
          const cleanMsg = error.message.replace('DUPLICATE_INVOICE: ', '');
          toast.error(cleanMsg, { duration: 8000 });
          setIsSaving(false);
          return;
        }
        throw new Error(error.message);
      }

      setIsSuccess(true);
      sessionStorage.removeItem('manual_purchase_draft');
      setTimeout(() => {
         router.push('/purchases');
      }, 2000);
    } catch (err: any) {
      const msg = err.message || 'Failed to save purchase invoice';
      if (msg.includes('DUPLICATE_INVOICE')) {
        toast.error(msg.replace('DUPLICATE_INVOICE: ', ''), { duration: 8000 });
      } else {
        setError(msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  useKeyboardShortcuts([
    { key: 'n', ctrl: true, shift: true, action: addItem, allowInInput: true },
    { key: 'Enter', ctrl: true, action: () => handleSave(), allowInInput: true }
  ]);

  if (isSuccess) {
    return (
        <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-6 text-center">
            <CheckCircle2 size={80} className="text-emerald-500 animate-bounce" />
            <div className="grid gap-2">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Stock Added Manually!</h2>
              <p className="text-muted-foreground font-medium">Inventory updated successfully. Redirecting...</p>
            </div>
        </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="container py-4 flex flex-col gap-4 pb-28">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/purchases" />} className="rounded-full">
            <ArrowLeft size={24} />
        </Button>
        <h1 className="text-lg font-bold tracking-tight">Manual Purchase Entry</h1>
      </header>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-xl border border-red-200">
           {error}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {/* ─── Invoice Header ─── */}
        <InvoiceHeaderCard
          data={{ ...invoiceData, total: totals.total }}
          onChange={(field, value) => setInvoiceData({ ...invoiceData, [field]: value })}
          distributors={distributors}
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
             <PurchaseItemCard
               key={idx}
               item={item}
               index={idx}
               onChange={handleItemChange}
               onRemove={removeItem}
               medicines={medicines}
               manufacturers={manufacturers}
               canRemove={items.length > 1}
             />
          ))}
        </div>

        {/* ─── Bottom Action Bar ─── */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/90 backdrop-blur-xl border-t border-border z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
           <div className="container max-w-4xl flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex gap-6 font-bold w-full sm:w-auto justify-center sm:justify-start">
                 <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase tracking-widest">Subtotal</span>₹{totals.subtotal.toFixed(2)}</div>
                 <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase tracking-widest">Tax</span>₹{totals.gstAmount.toFixed(2)}</div>
                 <div className="flex flex-col text-primary text-xl"><span className="text-[10px] text-muted-foreground uppercase tracking-widest">Net Total</span>₹{totals.total.toFixed(2)}</div>
              </div>
              <Button 
                 type="submit"
                 className="w-full sm:w-auto h-12 sm:h-11 px-6 text-base font-bold rounded-xl shadow-lg shadow-primary/15 flex gap-2 shrink-0"
                 disabled={isSaving}
              >
                 {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                 {isSaving ? 'Saving Invoice...' : `Save & Add to Inventory (${items.length} items)`}
              </Button>
           </div>
        </div>
      </form>
    </div>
  );
}
