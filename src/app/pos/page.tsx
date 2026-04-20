'use client';

import { useEffect, useState } from 'react';
import { loadStore, addInvoice } from '@/lib/store';
import { StoreData, Medicine, CartItem, Invoice, Batch } from '@/lib/types';
import { SearchBar } from '@/components/ui/SearchBar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { fuzzyMatch, formatCurrency, generateInvoiceNumber, generateId } from '@/lib/utils';
import { ShoppingCart, Plus, Minus, Trash2, Search, CheckCircle2 } from 'lucide-react';

export default function POS() {
  const [store, setStore] = useState<StoreData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  if (!store) return <div className="flex-center" style={{ height: '100vh' }}>Loading...</div>;

  // FEFO (First Expiry, First Out) batch selector
  const getNextAvailableBatch = (medicine: Medicine, cartQuantityForMed: number): Batch | null => {
    // Sort batches by expiry date
    const sortedBatches = [...medicine.batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    
    for (const batch of sortedBatches) {
        // How much of THIS batch is already in cart?
        const cartQtyThisBatch = cart.find(c => c.batchId === batch.id)?.quantity || 0;
        if (batch.quantity - cartQtyThisBatch > 0) {
            return batch;
        }
    }
    return null;
  };

  const searchedMedicines = searchQuery 
    ? store.medicines.filter(m => fuzzyMatch(m.name, searchQuery) || fuzzyMatch(m.genericName, searchQuery)).slice(0, 5)
    : [];

  const handleAddToCart = (medicine: Medicine) => {
    // Total quantity of THIS medicine already in cart
    const totalCartQty = cart.filter(c => c.medicineId === medicine.id).reduce((sum, c) => sum + c.quantity, 0);
    const totalAvailable = medicine.batches.reduce((sum, b) => sum + b.quantity, 0);

    if (totalCartQty >= totalAvailable) {
        alert('Not enough stock available!');
        return;
    }

    const batchToUse = getNextAvailableBatch(medicine, totalCartQty);
    if (!batchToUse) {
        alert('No valid batches available.');
        return;
    }

    // Is this exact batch already in the cart?
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
        // Remove item
        newCart.splice(index, 1);
        setCart(newCart);
        return;
    }

    // Check stock limit
    const medicine = store.medicines.find(m => m.id === item.medicineId);
    const batch = medicine?.batches.find(b => b.id === item.batchId);
    
    if (batch && item.quantity + delta > batch.quantity) {
        alert(`Only ${batch.quantity} limit for batch ${batch.batchNumber}`);
        return;
    }

    newCart[index].quantity += delta;
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Calculations
  let subtotal = 0;
  let gstAmount = 0;

  cart.forEach(item => {
      const itemTotal = item.quantity * item.mrp;
      subtotal += itemTotal;
      
      // Calculate GST portion of the MRP (MRP is inclusive of taxes in Indian pharma usually, 
      // but for this POC we calculate exclusive GST to show on invoice)
      // Base Price = MRP / (1 + GST%)
      const basePrice = itemTotal / (1 + (item.gstPercent / 100));
      gstAmount += (itemTotal - basePrice);
  });

  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal - discountAmount;

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const invoice: Invoice = {
        id: generateId(),
        invoiceNumber: generateInvoiceNumber(store.lastInvoiceNumber),
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim(),
        items: [...cart],
        subtotal,
        gstAmount,
        discountPercent,
        discountAmount,
        total,
        createdAt: new Date().toISOString()
    };

    // Update medicines stock
    const updatedMedicines = [...store.medicines];
    cart.forEach(cartItem => {
        const medIndex = updatedMedicines.findIndex(m => m.id === cartItem.medicineId);
        if (medIndex !== -1) {
            const med = { ...updatedMedicines[medIndex], batches: [...updatedMedicines[medIndex].batches] };
            const batchIndex = med.batches.findIndex(b => b.id === cartItem.batchId);
            if (batchIndex !== -1) {
                med.batches[batchIndex] = { ...med.batches[batchIndex], quantity: med.batches[batchIndex].quantity - cartItem.quantity };
            }
            updatedMedicines[medIndex] = med;
        }
    });

    addInvoice(invoice, updatedMedicines);
    setCart([]);
    setDiscountPercent(0);
    setCustomerName('');
    setCustomerPhone('');
    setLastInvoiceId(invoice.id);
    setIsSuccess(true);
    
    // Refresh store from localStorage so we have the latest stock
    setTimeout(() => {
        setStore(loadStore());
    }, 1000);
  };

  if (isSuccess) {
      return (
          <div className="flex-center" style={{ height: 'calc(100vh - 120px)', flexDirection: 'column', gap: '24px', padding: '20px', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-success)' }}><CheckCircle2 size={80} /></div>
              <div>
                <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Sale Completed!</h2>
                <p className="text-muted">Inventory updated and invoice generated.</p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '300px' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '16px' }}
                    onClick={() => {
                        window.open(`/invoice/${lastInvoiceId}`, '_blank');
                    }}
                  >
                    View & Print Invoice
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{ width: '100%', padding: '12px' }}
                    onClick={() => {
                        setIsSuccess(false);
                        setLastInvoiceId(null);
                    }}
                  >
                    New Sale
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '90px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem' }}>New Sale</h1>
        {cart.length > 0 && (
            <button className="text-muted" onClick={() => setCart([])} style={{ fontSize: '0.9rem' }}>Clear Cart</button>
        )}
      </header>

      {/* Search */}
      <div style={{ position: 'relative' }}>
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            onClear={() => setSearchQuery('')}
            placeholder="Search by name, generic..."
          />
          
          {searchQuery && (
              <Card className="absolute" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '8px', padding: '8px 0', border: '1px solid rgba(107,114,128,0.2)' }}>
                  {searchedMedicines.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No medicines found.</div>
                  ) : (
                      searchedMedicines.map(med => {
                          const totalStock = med.batches.reduce((sum, b) => sum + b.quantity, 0);
                          return (
                              <div 
                                  key={med.id} 
                                  onClick={() => totalStock > 0 && handleAddToCart(med)}
                                  style={{ padding: '12px 16px', borderBottom: '1px solid rgba(107,114,128,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: totalStock > 0 ? 'pointer' : 'not-allowed', opacity: totalStock === 0 ? 0.5 : 1 }}
                              >
                                  <div>
                                      <div style={{ fontWeight: '500' }}>{med.name}</div>
                                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                          {totalStock} in stock • MRP: ₹{med.batches[0]?.mrp || 0}
                                      </div>
                                  </div>
                                  <Plus size={20} color="var(--color-primary)" />
                              </div>
                          );
                      })
                  )}
              </Card>
          )}
      </div>

      {/* Cart Items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {cart.length === 0 ? (
              <div className="flex-center" style={{ flexDirection: 'column', gap: '16px', marginTop: '40px', color: 'var(--color-text-muted)' }}>
                  <ShoppingCart size={48} opacity={0.5} />
                  <p>Cart is empty. Search to add items.</p>
              </div>
          ) : (
              cart.map((item, i) => (
                  <Card key={`${item.batchId}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                      <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500' }}>{item.medicineName}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Batch: {item.batchNumber} • ₹{item.mrp}</div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-primary)', borderRadius: '100px', border: '1px solid rgba(107,114,128,0.2)' }}>
                              <button onClick={() => updateQuantity(i, -1)} style={{ padding: '8px' }} aria-label="Decrease">
                                  <Minus size={14} />
                              </button>
                              <span style={{ fontSize: '0.9rem', width: '20px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</span>
                              <button onClick={() => updateQuantity(i, 1)} style={{ padding: '8px' }} aria-label="Increase">
                                  <Plus size={14} />
                              </button>
                          </div>
                          <div style={{ fontWeight: 'bold', width: '60px', textAlign: 'right' }}>
                              ₹{(item.quantity * item.mrp).toFixed(2)}
                          </div>
                      </div>
                  </Card>
              ))
          )}
      </div>

      {/* Customer Info */}
      {cart.length > 0 && (
          <Card style={{ marginBottom: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--color-text-muted)' }}>Customer Details (Optional)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                      <input 
                        className="input" 
                        placeholder="Customer Name" 
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                      />
                  </div>
                  <div>
                      <input 
                        className="input" 
                        placeholder="Phone Number" 
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                      />
                  </div>
              </div>
          </Card>
      )}

      {/* Checkout Summary Footer */}
      {cart.length > 0 && (
          <Card style={{ marginTop: 'auto', background: 'var(--color-bg-card)', border: '1px solid var(--color-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                  <span className="text-muted">Subtotal ({cart.reduce((sum, c)=>sum+c.quantity, 0)} items)</span>
                  <span>{formatCurrency(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                  <span className="text-muted">Incl. GST</span>
                  <span>{formatCurrency(gstAmount)}</span>
              </div>
              
              {/* Discount Input */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderTop: '1px dashed rgba(107,114,128,0.2)', paddingTop: '8px' }}>
                  <span className="text-muted flex-center" style={{ gap: '8px' }}>Discount %</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button className="btn btn-outline" style={{ padding: '2px 8px' }} onClick={() => setDiscountPercent(0)}>0</button>
                      <button className="btn btn-outline" style={{ padding: '2px 8px' }} onClick={() => setDiscountPercent(5)}>5</button>
                      <button className="btn btn-outline" style={{ padding: '2px 8px' }} onClick={() => setDiscountPercent(10)}>10</button>
                  </div>
              </div>

              {discountPercent > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem', color: 'var(--color-success)' }}>
                      <span>Discount applied</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                  </div>
              )}

              <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '16px', fontSize: '1.2rem', display: 'flex', justifyContent: 'space-between' }}
                  onClick={handleCheckout}
              >
                  <span>Checkout</span>
                  <strong>{formatCurrency(total)}</strong>
              </button>
          </Card>
      )}
    </div>
  );
}
