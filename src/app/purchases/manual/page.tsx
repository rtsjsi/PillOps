'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { fetchUserProfile } from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Trash2, Save, CheckCircle2, Loader2, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { fetchMedicines } from '@/lib/queries';
import { useMedicineSearch } from '@/hooks/use-medicine-search';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useDistinctValues } from '@/hooks/use-distinct-values';
import { cn } from '@/lib/utils';
import { GenericAutocomplete } from '@/components/ui/autocomplete';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { MedicineAutocomplete } from '@/components/purchases/medicine-autocomplete';
export default function ManualPurchaseEntry() {
  const router = useRouter();
  const distributors = useDistinctValues('purchase_invoices', 'distributor_name');
  const manufacturers = useDistinctValues('global_medicines', 'manufacturer', true);

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoiceData, setInvoiceData] = useState({
    distributorName: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
  });

  const [items, setItems] = useState([
    {
      medicineName: '',
      category: '',
      manufacturer: '',
      batchNumber: '',
      expiryDate: '',
      quantity: 1,
      freeQuantity: 0,
      purchasePrice: 0,
      mrp: 0,
      discountPercent: 0,
      gstPercent: 12,
      totalAmount: 0
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

  const handleInvoiceChange = (field: string, value: string) => {
    setInvoiceData({ ...invoiceData, [field]: value });
  };

  const handleItemChange = (idx: number, field: string, value: any, fullItem?: any) => {
    const newItems = [...items];
    (newItems[idx] as any)[field] = value;
    
    // Auto-fill from global master if available
    if (field === 'medicineName' && fullItem) {
      if (fullItem.gstPercent !== undefined) newItems[idx].gstPercent = fullItem.gstPercent;
      if (fullItem.manufacturer !== undefined) (newItems[idx] as any).manufacturer = fullItem.manufacturer;
      if (fullItem.hsnCode !== undefined) (newItems[idx] as any).hsnCode = fullItem.hsnCode;
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
      medicineName: '',
      category: '',
      manufacturer: '',
      batchNumber: '',
      expiryDate: '',
      quantity: 1,
      freeQuantity: 0,
      purchasePrice: 0,
      mrp: 0,
      discountPercent: 0,
      gstPercent: 12,
      totalAmount: 0
    }]);
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    const newItems = items.filter((_, i) => i !== idx);
    setItems(newItems);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let discountAmount = 0;
    let gstAmount = 0;
    let total = 0;

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

      if (error) throw new Error(error.message);

      setIsSuccess(true);
      sessionStorage.removeItem('manual_purchase_draft');
      setTimeout(() => {
         router.push('/purchases');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save purchase invoice');
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
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Stock Added Manually!</h2>
              <p className="text-muted-foreground font-medium">Inventory updated successfully. Redirecting...</p>
            </div>
        </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="container py-8 flex flex-col gap-6 pb-32">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/purchases" />} className="rounded-full">
            <ArrowLeft size={24} />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Manual Purchase Entry</h1>
      </header>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-xl border border-red-200">
           {error}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <Card className="border-primary/20 shadow-xl shadow-primary/5">
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
               <Label>Distributor Name</Label>
               <GenericAutocomplete 
                 autoFocus 
                 required 
                 placeholder="Enter distributor name" 
                 value={invoiceData.distributorName} 
                 onValueChange={v => handleInvoiceChange('distributorName', v)} 
                 options={distributors}
               />
            </div>
            <div className="space-y-1.5">
               <Label>Invoice Number</Label>
               <Input required placeholder="e.g. INV-12345" value={invoiceData.invoiceNumber} onChange={e => handleInvoiceChange('invoiceNumber', e.target.value)} />
            </div>
            <div className="space-y-1.5">
               <Label>Invoice Date</Label>
               <Input required type="date" value={invoiceData.invoiceDate} onChange={e => handleInvoiceChange('invoiceDate', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
           <h2 className="text-xl font-bold tracking-tight">Line Items</h2>
           <Button type="button" onClick={addItem} variant="outline" size="sm" className="rounded-full font-bold">
               <Plus size={16} className="mr-2" /> Add Item
           </Button>
        </div>

        <div className="flex flex-col gap-4">
          {items.map((item, idx) => (
             <Card key={idx} className="relative ring-1 ring-slate-200 overflow-visible">
                <CardHeader className="p-4 flex flex-row items-center gap-4 pb-0">
                  <span className="bg-slate-800 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0">
                    {idx + 1}
                  </span>
                  <MedicineAutocomplete 
                    value={item.medicineName} 
                    onChange={(val, fullItem) => handleItemChange(idx, 'medicineName', val, fullItem)}
                    medicines={medicines}
                  />
                  {items.length > 1 && (
                     <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-rose-500 shrink-0">
                        <Trash2 size={18} />
                     </Button>
                  )}
                </CardHeader>
                
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Category</Label>
                      <Select value={(item as any).category || ''} onValueChange={(v) => handleItemChange(idx, 'category', v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Sachet', 'OTC'].map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Manufacturer</Label>
                      <GenericAutocomplete placeholder="e.g. Cipla" value={(item as any).manufacturer || ''} onValueChange={v=>handleItemChange(idx, 'manufacturer', v)} options={manufacturers} className="h-9"/>
                    </div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Batch</Label><Input required value={item.batchNumber} onChange={e=>handleItemChange(idx, 'batchNumber', e.target.value)} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Exp (MM-YYYY)</Label><Input required placeholder="12-2025" value={item.expiryDate} onChange={e=>{
                       let v = e.target.value.replace(/\D/g, '').substring(0, 6);
                       if (v.length >= 3) v = `${v.substring(0, 2)}-${v.substring(2, 6)}`;
                       handleItemChange(idx, 'expiryDate', v);
                    }} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Rate (₹)</Label><Input required type="number" step="0.01" value={item.purchasePrice || ''} onChange={e=>handleItemChange(idx, 'purchasePrice', parseFloat(e.target.value))} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">MRP (₹)</Label><Input required type="number" step="0.01" value={item.mrp || ''} onChange={e=>handleItemChange(idx, 'mrp', parseFloat(e.target.value))} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Qty</Label><Input required type="number" value={item.quantity || ''} onChange={e=>handleItemChange(idx, 'quantity', parseInt(e.target.value))} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Free</Label><Input type="number" value={item.freeQuantity || ''} onChange={e=>handleItemChange(idx, 'freeQuantity', parseInt(e.target.value))} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Disc %</Label><Input type="number" step="0.1" value={item.discountPercent || ''} onChange={e=>handleItemChange(idx, 'discountPercent', parseFloat(e.target.value))} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">GST %</Label><Input type="number" step="0.1" value={item.gstPercent || ''} onChange={e=>handleItemChange(idx, 'gstPercent', parseFloat(e.target.value))} className="h-9"/></div>
                  </div>
                </CardContent>
             </Card>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/90 backdrop-blur-xl border-t border-border z-50 lg:p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
           <div className="container max-w-4xl flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex gap-6 font-bold">
                 <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase tracking-widest">Subtotal</span>₹{totals.subtotal.toFixed(2)}</div>
                 <div className="flex flex-col"><span className="text-[10px] text-muted-foreground uppercase tracking-widest">Tax</span>₹{totals.gstAmount.toFixed(2)}</div>
                 <div className="flex flex-col text-primary text-xl"><span className="text-[10px] text-muted-foreground uppercase tracking-widest">Net Total</span>₹{totals.total.toFixed(2)}</div>
              </div>
              <Button 
                 type="submit"
                 className="w-full md:w-auto h-14 px-8 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 flex gap-2 shrink-0"
                 disabled={isSaving}
              >
                 {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                 {isSaving ? 'Saving Invoice...' : 'Save & Add to Inventory'}
              </Button>
           </div>
        </div>
      </form>
    </div>
  );
}
