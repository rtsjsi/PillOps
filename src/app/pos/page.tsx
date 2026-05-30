'use client';

import { useEffect, useState } from 'react';
import { getMedicines, createInvoice, getStoreSettings, getPOSData } from '@/app/actions';
import { CartItem, Batch } from '@/lib/types';
import { SearchBar } from '@/components/ui/searchBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fuzzyMatch, formatCurrency, generateInvoiceNumber, cn } from '@/lib/utils';
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle2, Loader2, Printer, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GenericTableLoading from '@/components/ui/tableLoading';

export default function POS() {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const { medicines: medData, storeSettings: settings } = await getPOSData();
        setMedicines(medData);
        setStoreSettings(settings);
      } catch (error) {
        console.error('Failed to fetch POS data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getNextAvailableBatch = (medicine: any, cartQuantityForMed: number): Batch | null => {
    const sortedBatches = [...medicine.batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    for (const batch of sortedBatches) {
        const cartQtyThisBatch = cart.find(c => c.batchId === batch.id)?.quantity || 0;
        if (batch.quantity - cartQtyThisBatch > 0) {
            return batch as any;
        }
    }
    return null;
  };

  const searchedMedicines = searchQuery 
    ? medicines.filter(m => fuzzyMatch(searchQuery, m.name) || fuzzyMatch(searchQuery, m.genericName)).slice(0, 5)
    : [];

  const handleAddToCart = (medicine: any) => {
    const totalCartQty = cart.filter(c => c.medicineId === medicine.id).reduce((sum, c) => sum + c.quantity, 0);
    const totalAvailable = medicine.batches.reduce((sum: number, b: any) => sum + b.quantity, 0);

    if (totalCartQty >= totalAvailable) {
        alert('Not enough stock available!');
        return;
    }

    const batchToUse = getNextAvailableBatch(medicine, totalCartQty);
    if (!batchToUse) {
        alert('No valid batches available.');
        return;
    }

    const existingCartItemIndex = cart.findIndex(c => c.batchId === batchToUse.id);

    if (existingCartItemIndex !== -1) {
        const newCart = [...cart];
        newCart[existingCartItemIndex].quantity += 1;
        setCart(newCart);
    } else {
        setCart([...cart, {
            medicineId: medicine.id,
            medicineName: medicine.name,
            batchId: batchToUse.id,
            batchNumber: batchToUse.batchNumber,
            quantity: 1,
            mrp: batchToUse.mrp,
            gstPercent: medicine.gstPercent,
            expiryDate: batchToUse.expiryDate
        }]);
    }
    setSearchQuery('');
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    if (item.quantity + delta <= 0) {
        newCart.splice(index, 1);
        setCart(newCart);
        return;
    }
    const medicine = medicines.find(m => m.id === item.medicineId);
    const batch = medicine?.batches.find((b: any) => b.id === item.batchId);
    if (batch && item.quantity + delta > batch.quantity) {
        alert(`Only ${batch.quantity} limit for batch ${batch.batchNumber}`);
        return;
    }
    newCart[index].quantity += delta;
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
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal - discountAmount;

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    try {
        const invoiceData = {
            invoiceNumber: generateInvoiceNumber(),
            customerName: customerName.trim() || 'Walk-in Customer',
            customerPhone: customerPhone.trim(),
            subtotal,
            gstAmount,
            discountPercent,
            discountAmount,
            total,
        };

        const result = await createInvoice(invoiceData, cart);
        
        setCart([]);
        setDiscountPercent(0);
        setCustomerName('');
        setCustomerPhone('');
        setLastInvoiceId(result.id);
        setIsSuccess(true);
        
        // Refresh medicines data
        const freshMeds = await getMedicines();
        const freshSettings = await getStoreSettings();
        setMedicines(freshMeds);
        setStoreSettings(freshSettings);
    } catch (error) {
        console.error('Checkout failed:', error);
        alert('Checkout failed. Please try again.');
    } finally {
        setIsCheckingOut(false);
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
                    New Sale
                  </Button>
              </div>
          </div>
      );
  }

  return (
    <div className="container py-8 flex flex-col gap-6 pb-32">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">New Sale</h1>
        {cart.length > 0 && (
            <Button variant="ghost" size="sm" className="text-muted-foreground font-bold hover:text-red-500" onClick={() => setCart([])}>
              Clear Cart
            </Button>
        )}
      </header>

      <div className="relative">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            onClear={() => setSearchQuery('')}
            placeholder="Search by name, generic..."
          />
          
          {searchQuery && (
              <Card className="absolute top-full left-0 right-0 z-50 mt-2 shadow-2xl border-primary/20 overflow-hidden bg-card/95 backdrop-blur-xl">
                  {searchedMedicines.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground font-medium">No medicines found.</div>
                  ) : (
                      <div className="divide-y divide-border">
                        {searchedMedicines.map(med => {
                            const totalStock = med.batches.reduce((sum: number, b: any) => sum + b.quantity, 0);
                            return (
                                <div 
                                    key={med.id} 
                                    onClick={() => totalStock > 0 && handleAddToCart(med)}
                                    className={cn(
                                      "p-4 flex justify-between items-center transition-colors",
                                      totalStock > 0 ? "cursor-pointer hover:bg-muted/50" : "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <div>
                                        <p className="font-bold">{med.name}</p>
                                        <p className="text-xs text-muted-foreground font-medium">
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
      </div>

      <div className="flex flex-col gap-3">
          {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground bg-muted/10 rounded-3xl border-2 border-dashed">
                  <ShoppingCart size={48} className="opacity-20" />
                  <p className="font-medium">Cart is empty. Search to add items.</p>
              </div>
          ) : (
              cart.map((item, i) => (
                  <Card key={`${item.batchId}-${i}`} className="p-4 flex justify-between items-center border-none shadow-sm">
                      <div className="flex-1">
                          <p className="font-bold text-sm">{item.medicineName}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Batch: {item.batchNumber} • MRP: ₹{item.mrp}</p>
                      </div>
                      
                      <div className="flex items-center gap-6">
                          <div className="flex items-center bg-muted/50 rounded-full border border-border">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateQuantity(i, -1)}>
                                  <Minus size={14} />
                              </Button>
                              <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateQuantity(i, 1)}>
                                  <Plus size={14} />
                              </Button>
                          </div>
                          <div className="font-bold text-sm w-20 text-right">
                              {formatCurrency(item.quantity * item.mrp)}
                          </div>
                      </div>
                  </Card>
              ))
          )}
      </div>

      {cart.length > 0 && (
          <Card className="bg-muted/30 border-none">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Customer Details (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input 
                    placeholder="Name" 
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
              </CardContent>
          </Card>
      )}

      {cart.length > 0 && (
          <div className="fixed bottom-6 left-4 right-4 z-40 lg:left-auto lg:right-4 lg:w-96">
            <Card className="bg-card/80 backdrop-blur-2xl border-primary/20 shadow-2xl shadow-primary/20">
                <CardContent className="p-6">
                  <div className="flex justify-between mb-2 text-sm font-medium">
                      <span className="text-muted-foreground">Subtotal ({cart.reduce((sum, c)=>sum+c.quantity, 0)} items)</span>
                      <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex flex-col gap-3 mb-6 pt-3 border-t border-dashed border-border">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Apply Discount</span>
                      <div className="flex justify-between gap-2">
                          {[0, 5, 10, 15].map(d => (
                              <Button key={d} variant={discountPercent === d ? 'default' : 'outline'} size="sm" className="flex-1 rounded-lg" onClick={() => setDiscountPercent(d)}>{d}%</Button>
                          ))}
                      </div>
                  </div>
                  <Button 
                      className="w-full h-14 text-xl font-bold rounded-2xl flex justify-between px-6 shadow-xl shadow-primary/30"
                      disabled={isCheckingOut}
                      onClick={handleCheckout}
                  >
                      <span>{isCheckingOut ? 'Wait...' : 'Checkout'}</span>
                      <strong>{formatCurrency(total)}</strong>
                  </Button>
                </CardContent>
            </Card>
          </div>
      )}
    </div>
  );
}


