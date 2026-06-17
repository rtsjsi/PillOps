'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Save } from 'lucide-react';
import Link from 'next/link';
import { MedicineAutocomplete } from '@/components/purchases/medicine-autocomplete';
import { fetchMedicines, saveInventoryAdjustment } from '@/lib/queries';
import { useDistinctValues } from '@/hooks/use-distinct-values';
import { GenericAutocomplete } from '@/components/ui/autocomplete';

export default function AddMiscStock() {
  const router = useRouter();
  const [medicines, setMedicines] = useState<any[]>([]);
  const reasons = useDistinctValues('inventory_adjustments', 'reason');
  
  // Fetch medicines on mount
  useEffect(() => {
    fetchMedicines().then(setMedicines).catch(console.error);
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adjustmentData, setAdjustmentData] = useState({
    type: 'IN',
    reason: 'Opening Balance'
  });

  const [items, setItems] = useState<any[]>([{
    medicineName: '',
    batchNumber: '',
    expiryDate: '',
    quantity: 0,
    mrp: 0,
    purchasePrice: 0,
  }]);

  const handleAdjustmentChange = (field: string, value: any) => {
    setAdjustmentData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index: number, field: string, value: any, fullItemData?: any) => {
    setItems(prev => {
      const newItems = [...prev];
      const finalValue = field === 'medicineName' && typeof value === 'string' ? value.toUpperCase() : value;
      newItems[index] = { ...newItems[index], [field]: finalValue };
      
      // Auto-fill from catalog if selected
      if (fullItemData) {
         newItems[index] = {
           ...newItems[index],
           medicineName: (fullItemData.name || '').toUpperCase(),
         };
      }
      return newItems;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      medicineName: '',
      batchNumber: '',
      expiryDate: '',
      quantity: 0,
      mrp: 0,
      purchasePrice: 0,
    }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (items.some(i => !i.medicineName || !i.batchNumber || !i.quantity || !i.expiryDate)) {
      setError("Please fill out all required fields for each item.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const formattedItems = items.map(item => {
         const [mm, yyyy] = item.expiryDate.split('-');
         return { ...item, expiryDate: `${yyyy}-${mm}` };
      });

      await saveInventoryAdjustment(adjustmentData, formattedItems);

      setIsSuccess(true);
      setTimeout(() => {
         router.push('/inventory');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to save inventory adjustment');
    } finally {
      setIsSaving(false);
    }
  };

  if (isSuccess) {
    return (
        <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-6 text-center">
            <CheckCircle2 size={80} className="text-emerald-500 animate-bounce" />
            <div className="grid gap-2">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Stock Adjusted Successfully!</h2>
              <p className="text-muted-foreground font-medium">Redirecting to inventory...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="container py-8 flex flex-col gap-6 pb-32">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/inventory" />} className="rounded-full">
            <ArrowLeft size={24} />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Add Miscellaneous Stock</h1>
      </header>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-xl border border-red-200">
           {error}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <Card className="border-primary/20 shadow-xl shadow-primary/5">
          <CardHeader>
            <CardTitle>Adjustment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
               <Label>Type</Label>
               <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={adjustmentData.type}
                  onChange={e => handleAdjustmentChange('type', e.target.value)}
               >
                   <option value="IN">Stock IN (Addition)</option>
                   <option value="OUT">Stock OUT (Deduction)</option>
               </select>
            </div>
            <div className="space-y-1.5">
               <Label>Reason / Note</Label>
               <GenericAutocomplete 
                 required 
                 placeholder="e.g. Opening Balance, Manual Correction" 
                 value={adjustmentData.reason} 
                 onValueChange={v => handleAdjustmentChange('reason', v)} 
                 options={reasons}
               />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
           <h2 className="text-xl font-bold tracking-tight">Items</h2>
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
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Batch</Label><Input required value={item.batchNumber} onChange={e=>handleItemChange(idx, 'batchNumber', e.target.value)} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Exp (MM-YYYY)</Label><Input required placeholder="12-2025" value={item.expiryDate} onChange={e=>{
                       let v = e.target.value.replace(/\D/g, '').substring(0, 6);
                       if (v.length >= 3) v = `${v.substring(0, 2)}-${v.substring(2, 6)}`;
                       handleItemChange(idx, 'expiryDate', v);
                    }} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Qty</Label><Input required type="number" value={item.quantity || ''} onChange={e=>handleItemChange(idx, 'quantity', parseInt(e.target.value))} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">Rate (₹)</Label><Input type="number" step="0.01" value={item.purchasePrice || ''} onChange={e=>handleItemChange(idx, 'purchasePrice', parseFloat(e.target.value))} className="h-9"/></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground uppercase">MRP (₹)</Label><Input type="number" step="0.01" value={item.mrp || ''} onChange={e=>handleItemChange(idx, 'mrp', parseFloat(e.target.value))} className="h-9"/></div>
                  </div>
                </CardContent>
             </Card>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border z-40 flex justify-end">
            <Button type="submit" disabled={isSaving} size="lg" className="w-full sm:w-auto h-12 px-8 font-bold shadow-xl shadow-primary/20">
                {isSaving ? 'Saving...' : <><Save className="mr-2" size={18} /> Save Adjustment</>}
            </Button>
        </div>
      </form>
    </div>
  );
}
