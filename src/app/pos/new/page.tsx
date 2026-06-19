'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchMedicines, fetchStoreSettings, fetchUserProfile, fetchInvoices } from '@/lib/queries';
import { createClient } from '@/utils/supabase/client';
import { CartItem, StoreInventoryBatch } from '@/lib/types';
import { SearchBar } from '@/components/ui/searchBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, generateInvoiceNumber, cn } from '@/lib/utils';
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle2, Printer, PlusCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GenericTableLoading from '@/components/ui/tableLoading';
import { toast } from 'sonner';
import { useMedicineSearch } from '@/hooks/use-medicine-search';
import { MedicineAutocomplete } from '@/components/purchases/medicine-autocomplete';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useDistinctValues } from '@/hooks/use-distinct-values';
import { GenericAutocomplete } from '@/components/ui/autocomplete';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const InvoicePDFWrapper = dynamic(
  () => import('@/components/invoice/invoice-pdf-wrapper').then((mod) => mod.InvoicePDFWrapper),
  { ssr: false }
);

export default function POS() {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number | string>(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [area, setArea] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const customerNames = useDistinctValues('customers', 'name', false);
  const customerPhones = useDistinctValues('sales_invoices', 'customer_phone');
  const doctorNames = useDistinctValues('sales_invoices', 'doctor_name');
  const areas = useDistinctValues('sales_invoices', 'area');

  const [searchValue, setSearchValue] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [medData, settings, sales] = await Promise.all([fetchMedicines(), fetchStoreSettings(), fetchInvoices(5)]);
        setMedicines(medData);
        setStoreSettings(settings);
        setRecentSales(sales);
      } catch (error) {
        console.error('Failed to fetch POS data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Autofocus search on load and after success screen
  useEffect(() => {
    if (!loading && !isSuccess) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [loading, isSuccess]);

  const getNextAvailableBatch = (medicine: any, cartQuantityForMed: number): StoreInventoryBatch | null => {
    const sortedBatches = [...medicine.batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    for (const batch of sortedBatches) {
        const cartQtyThisBatch = cart.find(c => c.storeInventoryBatchId === batch.id)?.quantity || 0;
        if (batch.quantity - cartQtyThisBatch > 0) {
            return batch as any;
        }
    }
    return null;
  };

  const handleAddToCart = (medicine: any) => {
    const totalCartQty = cart.filter(c => c.medicineId === medicine.id).reduce((sum, c) => sum + c.quantity, 0);
    const totalAvailable = medicine.totalStock;

    if (totalCartQty >= totalAvailable) {
        toast.error('Not enough stock available!');
        return;
    }

    const batchToUse = getNextAvailableBatch(medicine, totalCartQty);
    if (!batchToUse) {
        toast.error('No valid batches available.');
        return;
    }

    const existingCartItemIndex = cart.findIndex(c => c.storeInventoryBatchId === batchToUse.id);

    if (existingCartItemIndex !== -1) {
        const newCart = [...cart];
        newCart[existingCartItemIndex].quantity += 1;
        setCart(newCart);
    } else {
        setCart([...cart, {
            medicineId: medicine.id,
            medicineName: medicine.name,
            storeInventoryBatchId: batchToUse.id,
            batchNumber: batchToUse.batchNumber,
            quantity: 1,
            mrp: batchToUse.mrp,
            gstPercent: medicine.gstPercent,
            expiryDate: batchToUse.expiryDate
        }]);
    }
    setSearchValue('');
    searchInputRef.current?.focus();
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
        return;
    }
    const newCart = [...cart];
    const item = newCart[index];
    const medicine = medicines.find(m => m.id === item.medicineId);
    const batch = medicine?.batches.find((b: any) => b.id === item.storeInventoryBatchId);
    
    if (batch && newQty > batch.quantity) {
        toast.error(`Only ${batch.quantity} limit for batch ${batch.batchNumber}`);
        return;
    }
    
    newCart[index].quantity = newQty;
    setCart(newCart);
  };

  let subtotal = 0;
  let gstAmount = 0;
  cart.forEach(item => {
      const itemTotal = item.quantity * item.mrp;
      subtotal += itemTotal;
      const basePrice = itemTotal / (1 + (item.gstPercent / 100));
      gstAmount += (itemTotal - basePrice);
  });
  
  const currentDiscount = typeof discountPercent === 'number' ? discountPercent : parseFloat(discountPercent) || 0;
  const discountAmount = subtotal * (currentDiscount / 100);
  const total = subtotal - discountAmount;

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    try {
        const profile = await fetchUserProfile();
        if (!profile?.store_id) throw new Error("Store ID not found");

        const invoiceData = {
            invoiceNumber: generateInvoiceNumber(),
            customerName: customerName.trim() || 'Walk-in Customer',
            customerPhone: customerPhone.trim(),
            doctorName: doctorName.trim() || 'WALK-IN',
            area: area.trim() || 'LOCAL',
            subtotal,
            gstAmount,
            discountPercent: currentDiscount,
            discountAmount,
            total,
        };

        const supabase = createClient();
        
        const itemsPayload = cart.map(item => ({
            ...item,
            batchId: item.storeInventoryBatchId
        }));

        const { data: result, error } = await supabase.rpc('save_sales_invoice', {
            invoice_data: { ...invoiceData, storeId: profile.store_id },
            items: itemsPayload,
        });
        
        if (error) throw error;
        
        setCart([]);
        setDiscountPercent(0);
        setCustomerName('');
        setCustomerPhone('');
        setDoctorName('');
        setArea('');
        setLastInvoiceId(result?.id || result);
        setIsSuccess(true);
        toast.success('Sale completed successfully');
        
        // Refresh medicines and recent sales data
        const [freshMeds, freshSales] = await Promise.all([fetchMedicines(), fetchInvoices(5)]);
        setMedicines(freshMeds);
        setRecentSales(freshSales);
    } catch (error: any) {
        console.error('Checkout failed:', error);
        toast.error(error.message || 'Checkout failed. Please try again.');
    } finally {
        setIsCheckingOut(false);
    }
  };

  const startNewSale = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountPercent(0);
    setSearchValue('');
    searchInputRef.current?.focus();
  };

  // Keyboard Shortcuts
  useKeyboardShortcuts([
    {
      key: 'F2',
      action: startNewSale,
      allowInInput: true,
      description: 'New Sale / Clear Cart'
    },
    {
      key: 'Enter',
      ctrl: true,
      action: handleCheckout,
      allowInInput: true,
      description: 'Checkout'
    },
    {
      key: 'F5',
      action: handleCheckout,
      allowInInput: true,
      description: 'Checkout'
    }
  ]);

  const onMedicineSelect = (name: string, item?: any) => {
    if (item) {
      const totalStock = item.totalStock || 0;
      if (totalStock > 0) {
        handleAddToCart(item);
      } else {
        toast.error('Out of stock');
      }
    } else {
      setSearchValue(name);
    }
  };

  if (loading) return <GenericTableLoading />;

  if (isSuccess) {
      return (
          <div className="container min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center p-4">
              <div className="text-emerald-500 bg-emerald-500/10 p-4 rounded-full ring-4 ring-emerald-500/5 animate-bounce">
                <CheckCircle2 size={48} />
              </div>
              <div className="grid gap-1">
                <h2 className="text-xl font-extrabold tracking-tight">Sale Completed!</h2>
                <p className="text-sm text-muted-foreground font-medium">Inventory updated and invoice generated.</p>
              </div>
              
              <div className="flex flex-col gap-2 w-full max-w-sm">
                  <InvoicePDFWrapper 
                    invoiceId={lastInvoiceId} 
                    size="lg" 
                    className="w-full h-11 text-base font-bold shadow-lg shadow-primary/20" 
                  />
                  <Button variant="outline" size="lg" className="w-full h-10" onClick={() => { setIsSuccess(false); setLastInvoiceId(null); }}>
                    New Sale (F2)
                  </Button>
                  <Button render={<Link href="/pos" />} variant="ghost" size="lg" className="w-full h-10">
                    Back to Sales List
                  </Button>
              </div>
          </div>
      );
  }

  // Get recent 5 items for quick add
  const recentItems = medicines
    .filter(m => m.batches.some((b: any) => b.quantity > 0))
    .slice(0, 5);

  return (
    <div className="container py-4 flex flex-col gap-4 pb-[360px] lg:pb-4">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button render={<Link href="/pos" />} variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft size={20} />
          </Button>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
            <span><kbd className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">F2</kbd> New</span>
            <span><kbd className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">F5</kbd> / <kbd className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Ctrl+Enter</kbd> Checkout</span>
            <span><kbd className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">Esc</kbd> Clear</span>
          </div>
        </div>
        {cart.length > 0 && (
            <Button variant="ghost" size="sm" className="text-muted-foreground font-bold hover:text-destructive" onClick={startNewSale}>
              Clear Cart
            </Button>
        )}
      </header>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Left Side: Search and Cart Items */}
        <div className="flex-1 w-full flex flex-col gap-4">
          <div className="relative z-50">
              <MedicineAutocomplete
                inputRef={searchInputRef}
                value={searchValue}
                onChange={onMedicineSelect}
                medicines={medicines}
                placeholder="Search by name, generic... (Autofocus enabled)"
                autoFocus
                className="font-bold border border-border bg-background shadow-sm h-11 text-base"
              />
              
              {/* Quick Add Chips (when empty search) */}
              {cart.length === 0 && !searchValue && recentItems.length > 0 && (
                <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest shrink-0">Quick Add:</span>
                  {recentItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleAddToCart(item)}
                      className="shrink-0 text-xs font-bold bg-muted/50 hover:bg-muted text-foreground border border-border px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
                    >
                      <Plus size={12} />
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
          </div>

          <div className="flex flex-col gap-3">
              {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed border-border/50">
                      <ShoppingCart size={36} className="opacity-20" />
                      <p className="text-sm font-medium">Cart is empty. Search to add items.</p>
                  </div>
              ) : (
                  cart.map((item, i) => (
                      <Card key={`${item.storeInventoryBatchId}-${i}`} className="p-3 flex justify-between items-center border-border shadow-sm">
                          <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-sm">{item.medicineName}</p>
                              </div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                Batch: {item.batchNumber} • MRP: ₹{item.mrp}
                              </p>
                          </div>
                          
                          <div className="flex items-center gap-4">
                              <div className="flex items-center bg-muted/30 rounded-lg border border-border p-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => updateQuantity(i, item.quantity - 1)}>
                                      <Minus size={14} />
                                  </Button>
                                  <Input 
                                    type="number" 
                                    value={item.quantity || ''}
                                    onChange={(e) => updateQuantity(i, parseInt(e.target.value) || 0)}
                                    className="w-12 h-7 text-center font-bold border-none bg-transparent shadow-none focus-visible:ring-0 p-0"
                                    min={0}
                                  />
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => updateQuantity(i, item.quantity + 1)}>
                                      <Plus size={14} />
                                  </Button>
                              </div>
                              <div className="font-bold text-sm w-20 text-right">
                                  {formatCurrency(item.quantity * item.mrp)}
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => updateQuantity(i, 0)}>
                                  <Trash2 size={16} />
                              </Button>
                          </div>
                      </Card>
                  ))
              )}
          </div>
        </div>

        {/* Right Side: Checkout Panel */}
        {cart.length > 0 && (
            <div className="w-full lg:w-[380px] fixed bottom-0 left-0 right-0 p-3 lg:p-0 lg:sticky lg:top-4 z-40 bg-background/80 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none border-t lg:border-t-0 border-border lg:border-none shadow-[0_-8px_30px_rgba(0,0,0,0.08)] lg:shadow-none animate-in slide-in-from-bottom-10 lg:animate-none">
              <Card className="bg-card/95 backdrop-blur-2xl border-border shadow-2xl shadow-black/10">
                  <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Customer (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 flex flex-col gap-2.5 max-h-[45vh] lg:max-h-none overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                      <GenericAutocomplete 
                        placeholder="Customer Name" 
                        value={customerName}
                        onValueChange={setCustomerName}
                        options={customerNames}
                        className="bg-background h-10 text-sm"
                      />
                      <GenericAutocomplete 
                        placeholder="Phone" 
                        value={customerPhone}
                        onValueChange={setCustomerPhone}
                        options={customerPhones}
                        className="bg-background h-10 text-sm"
                      />
                      <GenericAutocomplete 
                        placeholder="Doctor Name" 
                        value={doctorName}
                        onValueChange={setDoctorName}
                        options={doctorNames}
                        className="bg-background h-10 text-sm"
                      />
                      <GenericAutocomplete 
                        placeholder="Hospital / Area" 
                        value={area}
                        onValueChange={setArea}
                        options={areas}
                        className="bg-background h-10 text-sm"
                      />
                    </div>

                    <div className="flex justify-between items-end gap-3 border-t border-dashed border-border pt-3">
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Discount</span>
                            <div className="flex items-center gap-1">
                                {[0, 5, 10].map(d => (
                                    <Button key={d} variant={currentDiscount === d ? 'default' : 'outline'} size="sm" className="h-8 px-2 flex-1" onClick={() => setDiscountPercent(d)}>{d}%</Button>
                                ))}
                                <div className="relative flex-1">
                                  <Input 
                                    type="number" 
                                    value={discountPercent} 
                                    onChange={(e) => setDiscountPercent(e.target.value)} 
                                    className="h-8 pr-6 text-sm"
                                    placeholder="Cust."
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-1 text-sm font-medium pt-2 border-t border-border">
                        <span className="text-muted-foreground">Subtotal ({cart.reduce((sum, c)=>sum+c.quantity, 0)} items)</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>

                    <Button 
                        className="w-full h-11 lg:h-12 text-base lg:text-lg font-bold rounded-xl flex justify-between px-4 shadow-lg shadow-primary/15 transition-transform active:scale-[0.98] shrink-0"
                        disabled={isCheckingOut}
                        onClick={handleCheckout}
                    >
                        <span>{isCheckingOut ? 'Wait...' : 'Checkout'}</span>
                        <div className="flex items-center gap-2">
                          <strong>{formatCurrency(total)}</strong>
                          <kbd className="hidden sm:inline-flex ml-2 text-[10px] font-mono bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded">F5</kbd>
                        </div>
                    </Button>
                  </CardContent>
              </Card>
            </div>
        )}
      </div>


    </div>
  );
}
