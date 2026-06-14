'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchMedicines, fetchStoreSettings, fetchUserProfile, fetchInvoices } from '@/lib/queries';
import { createClient } from '@/utils/supabase/client';
import { CartItem, StoreInventoryBatch } from '@/lib/types';
import { SearchBar } from '@/components/ui/searchBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, generateInvoiceNumber, cn } from '@/lib/utils';
import { ShoppingCart, Plus, Minus, Trash2, CheckCircle2, Printer, PlusCircle, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GenericTableLoading from '@/components/ui/tableLoading';
import { toast } from 'sonner';
import { useMedicineSearch } from '@/hooks/use-medicine-search';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import Link from 'next/link';

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

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchedMedicines,
    selectedIndex,
    isOpen,
    setIsOpen,
    handleKeyDown: handleSearchKeyDown,
    clear: clearSearch,
  } = useMedicineSearch({ medicines, maxResults: 8 });

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
    clearSearch();
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
    clearSearch();
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

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const selected = handleSearchKeyDown(e);
    if (selected) {
      const totalStock = selected.totalStock || 0;
      if (totalStock > 0) {
        handleAddToCart(selected);
      } else {
        toast.error('Out of stock');
      }
    }
  };

  if (loading) return <GenericTableLoading />;

  if (isSuccess) {
      return (
          <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-8 text-center p-6">
              <div className="text-emerald-500 bg-emerald-500/10 p-6 rounded-full ring-8 ring-emerald-500/5 animate-bounce">
                <CheckCircle2 size={64} />
              </div>
              <div className="grid gap-2">
                <h2 className="text-3xl font-extrabold tracking-tight">Sale Completed!</h2>
                <p className="text-muted-foreground font-medium">Inventory updated and invoice generated successfully.</p>
              </div>
              
              <div className="flex flex-col gap-3 w-full max-w-sm">
                  <Button size="lg" className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/20" onClick={() => window.open(`/invoice/${lastInvoiceId}`, '_blank')}>
                    <Printer className="mr-2" size={20} />
                    View & Print Invoice
                  </Button>
                  <Button variant="outline" size="lg" className="w-full h-12" onClick={() => { setIsSuccess(false); setLastInvoiceId(null); }}>
                    New Sale (F2)
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
    <div className="container py-8 flex flex-col gap-6 pb-[400px] lg:pb-8">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">New Sale</h1>
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

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Side: Search and Cart Items */}
        <div className="flex-1 w-full flex flex-col gap-6">
          <div className="relative z-50">
              <SearchBar 
                ref={searchInputRef}
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                onClear={clearSearch}
                onKeyDown={onSearchKeyDown}
                onFocus={() => setIsOpen(true)}
                placeholder="Search by name, generic... (Autofocus enabled)"
                data-search-input="true"
              />
              
              {isOpen && searchQuery && (
                  <Card className="absolute top-full left-0 right-0 mt-2 shadow-2xl border-border overflow-hidden bg-card/95 backdrop-blur-xl">
                      {searchedMedicines.length === 0 ? (
                          <div className="p-8 text-center text-muted-foreground font-medium">No medicines found.</div>
                      ) : (
                          <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                            {searchedMedicines.map((med, index) => {
                                const totalStock = med.totalStock || 0;
                                return (
                                    <div 
                                        key={med.id} 
                                        onClick={() => {
                                          if (totalStock > 0) handleAddToCart(med);
                                        }}
                                        className={cn(
                                          "p-4 flex justify-between items-center transition-colors",
                                          totalStock > 0 ? "cursor-pointer hover:bg-muted" : "opacity-50 cursor-not-allowed",
                                          index === selectedIndex && totalStock > 0 ? "bg-muted" : ""
                                        )}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                              <p className="font-bold">{med.name}</p>
                                              <Badge variant="secondary" className="text-[9px] h-4 px-1 uppercase">{med.category}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground font-medium mt-0.5">
                                                {totalStock} in stock • MRP: ₹{med.batches[0]?.mrp || 0}
                                            </p>
                                        </div>
                                        <PlusCircle size={24} className="text-primary" />
                                    </div>
                                );
                            })}
                          </div>
                      )}
                  </Card>
              )}
              
              {/* Quick Add Chips (when empty search) */}
              {cart.length === 0 && !searchQuery && recentItems.length > 0 && (
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
                  <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground bg-muted/20 rounded-3xl border-2 border-dashed border-border/50">
                      <ShoppingCart size={48} className="opacity-20" />
                      <p className="font-medium">Cart is empty. Search to add items.</p>
                  </div>
              ) : (
                  cart.map((item, i) => (
                      <Card key={`${item.storeInventoryBatchId}-${i}`} className="p-4 flex justify-between items-center border-border shadow-sm">
                          <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-sm">{item.medicineName}</p>
                              </div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                Batch: {item.batchNumber} • MRP: ₹{item.mrp}
                              </p>
                          </div>
                          
                          <div className="flex items-center gap-6">
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
            <div className="w-full lg:w-[400px] fixed bottom-0 left-0 right-0 p-4 lg:p-0 lg:sticky lg:top-8 z-40 bg-background/80 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none border-t lg:border-t-0 border-border lg:border-none shadow-[0_-10px_40px_rgba(0,0,0,0.1)] lg:shadow-none animate-in slide-in-from-bottom-10 lg:animate-none">
              <Card className="bg-card/95 backdrop-blur-2xl border-border shadow-2xl shadow-black/10">
                  <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Customer (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 lg:p-4 flex flex-col gap-3 lg:gap-4 max-h-[40vh] lg:max-h-none overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                      <Input 
                        placeholder="Customer Name" 
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="bg-background h-10 text-sm"
                      />
                      <Input 
                        placeholder="Phone" 
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="bg-background h-10 text-sm"
                      />
                      <Input 
                        placeholder="Doctor Name" 
                        value={doctorName}
                        onChange={(e) => setDoctorName(e.target.value)}
                        className="bg-background h-10 text-sm"
                      />
                      <Input 
                        placeholder="Hospital / Area" 
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className="bg-background h-10 text-sm"
                      />
                    </div>

                    <div className="flex justify-between items-end gap-4 border-t border-dashed border-border pt-4">
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
                        className="w-full h-12 lg:h-14 text-lg lg:text-xl font-bold rounded-xl lg:rounded-2xl flex justify-between px-4 lg:px-6 shadow-xl shadow-primary/20 transition-transform active:scale-[0.98] shrink-0"
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

      {/* Recent Sales Section */}
      <div className="flex flex-col gap-4 mt-4">
        <div className="flex items-center gap-2">
           <History size={20} className="text-muted-foreground" />
           <h2 className="text-xl font-bold tracking-tight">Recent Sales</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {recentSales.map((inv) => (
             <Card key={inv.id} className="p-4 border-border shadow-sm flex flex-col gap-2">
               <div className="flex justify-between items-start">
                  <div className="font-bold text-sm line-clamp-1">{inv.customerName || 'Walk-in'}</div>
                  <div className="text-emerald-600 font-extrabold text-sm">{formatCurrency(inv.total)}</div>
               </div>
               <div className="flex justify-between items-center text-xs text-muted-foreground font-medium mt-auto pt-2 border-t border-border/50">
                  <div className="bg-muted px-1.5 py-0.5 rounded">#{inv.invoiceNumber}</div>
                  <Button render={<Link href={`/invoice/${inv.id}`} />} variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-bold">
                     <Printer size={12} className="mr-1" /> Print
                  </Button>
               </div>
             </Card>
          ))}
          {recentSales.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl border-border/50">
              No recent sales found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
