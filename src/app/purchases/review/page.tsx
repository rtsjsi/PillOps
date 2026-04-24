'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { savePurchaseInvoice } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, cn } from '@/lib/utils';
import { CheckCircle2, ArrowLeft, Sparkles, Edit2, AlertTriangle, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GenericTableLoading from '@/components/ui/TableLoading';

export default function ReviewExtraction() {
  const router = useRouter();

  interface InvoiceItem {
    medicineName: string;
    batchNumber: string;
    expiryDate: string;
    purchasePrice: number;
    mrp: number;
    discountPercent: number;
    quantity: number;
    freeQuantity: number;
    manufacturer?: string;
    hsnCode?: string;
    gstPercent?: number;
  }

  interface InvoiceData {
    distributorName: string;
    invoiceDate: string;
    invoiceNumber: string;
    total: number;
    items: InvoiceItem[];
  }

  const [data, setData] = useState<InvoiceData | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleItemChange = (idx: number, field: keyof InvoiceItem, value: any) => {
    if (!data) return;
    const newItems = [...data.items];
    newItems[idx] = { ...newItems[idx], [field]: value } as InvoiceItem;
    setData({ ...data, items: newItems });
  };

  useEffect(() => {
    const rawData = sessionStorage.getItem('pillops_extracted_invoice');
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        setData(parsed);
      } catch (e) {
        setError("Failed to parse extracted invoice data.");
      }
    } else {
      setError("No invoice data found. Please scan an invoice first.");
    }
  }, []);

  const handleConfirm = async () => {
    if (!data || isSaving) return;
    setIsSaving(true);

    try {
        await savePurchaseInvoice(data, data.items);
        sessionStorage.removeItem('pillops_extracted_invoice');
        setIsSuccess(true);
        setTimeout(() => {
            router.push('/inventory');
        }, 2000);
    } catch (error: any) {
        console.error('Save failed:', error);
        setError(`Failed to save invoice: ${error.message || 'Unknown error'}`);
    } finally {
        setIsSaving(false);
    }
  };

  if (error) {
     return (
        <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-6 text-center">
           <AlertTriangle size={64} className="text-red-500 bg-red-500/10 p-4 rounded-full" />
           <div className="grid gap-2">
             <h2 className="text-2xl font-bold">Extraction Error</h2>
             <p className="text-muted-foreground">{error}</p>
           </div>
           <Button asChild size="lg" className="mt-4">
             <Link href="/purchases/scan">Try Again</Link>
           </Button>
        </div>
     );
  }

  if (!data) return <GenericTableLoading />;

  if (isSuccess) {
      return (
          <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-6 text-center">
              <CheckCircle2 size={80} className="text-emerald-500 animate-bounce" />
              <div className="grid gap-2">
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Stock Added!</h2>
                <p className="text-muted-foreground font-medium">Inventory updated successfully. Redirecting...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="container py-8 flex flex-col gap-6 pb-32">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/purchases/scan">
            <ArrowLeft size={24} />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
           Review Data
           <Sparkles size={24} className="text-primary animate-pulse" />
        </h1>
      </header>

      <Card className="bg-primary/5 border-primary/20 overflow-hidden shadow-xl shadow-primary/5">
        <CardContent className="p-6 grid grid-cols-2 gap-y-6">
            <div className="space-y-1">
               <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Distributor</Label>
               <p className="text-lg font-bold text-slate-900">{data.distributorName}</p>
            </div>
            <div className="space-y-1 text-right">
               <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Date</Label>
               <p className="text-lg font-bold text-slate-900">{data.invoiceDate}</p>
            </div>
            <div className="space-y-1">
               <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Invoice Number</Label>
               <p className="text-lg font-bold text-primary">{data.invoiceNumber}</p>
            </div>
            <div className="space-y-1 text-right">
               <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Net Amount</Label>
               <p className="text-2xl font-black text-emerald-600 tracking-tighter">{formatCurrency(data.total)}</p>
            </div>
        </CardContent>
      </Card>

      <div>
         <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-bold tracking-tight">Extracted Items ({data.items.length})</h2>
             <Button 
                variant={isEditing ? 'default' : 'outline'}
                size="sm"
                className={cn("rounded-full font-bold", isEditing && "bg-emerald-500 hover:bg-emerald-600")}
                onClick={() => setIsEditing(!isEditing)}
             >
                 {isEditing ? <CheckCircle2 size={16} className="mr-2" /> : <Edit2 size={16} className="mr-2" />} 
                 {isEditing ? 'Save Changes' : 'Edit Items'}
             </Button>
         </div>
         
         <div className="flex flex-col gap-4">
            {data.items.map((item: any, idx: number) => (
               <Card key={idx} className={cn("transition-all", isEditing && "ring-2 ring-primary/20 border-primary/30")}>
                  <CardHeader className="p-4 flex flex-row items-center gap-4 space-y-0">
                    <span className="bg-primary text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0">
                      {idx + 1}
                    </span>
                    {isEditing ? (
                        <Input 
                          value={item.medicineName} 
                          onChange={e => handleItemChange(idx, 'medicineName', e.target.value)} 
                          className="h-10 font-bold bg-muted/50"
                        />
                    ) : (
                        <CardTitle className="text-base font-bold text-slate-800">{item.medicineName}</CardTitle>
                    )}
                  </CardHeader>
                  
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {isEditing ? (
                        <>
                          <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Batch</Label><Input value={item.batchNumber} onChange={e=>handleItemChange(idx, 'batchNumber', e.target.value)} className="h-9 text-xs"/></div>
                          <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Exp (YYYY-MM)</Label><Input value={item.expiryDate} onChange={e=>handleItemChange(idx, 'expiryDate', e.target.value)} className="h-9 text-xs"/></div>
                          <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Rate</Label><Input type="number" value={item.purchasePrice} onChange={e=>handleItemChange(idx, 'purchasePrice', parseFloat(e.target.value))} className="h-9 text-xs"/></div>
                          <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">MRP</Label><Input type="number" value={item.mrp} onChange={e=>handleItemChange(idx, 'mrp', parseFloat(e.target.value))} className="h-9 text-xs"/></div>
                          <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Disc %</Label><Input type="number" value={item.discountPercent} onChange={e=>handleItemChange(idx, 'discountPercent', parseFloat(e.target.value))} className="h-9 text-xs"/></div>
                          <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Qty</Label><Input type="number" value={item.quantity} onChange={e=>handleItemChange(idx, 'quantity', parseInt(e.target.value))} className="h-9 text-xs"/></div>
                          <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Free</Label><Input type="number" value={item.freeQuantity} onChange={e=>handleItemChange(idx, 'freeQuantity', parseInt(e.target.value))} className="h-9 text-xs"/></div>
                          <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">GST %</Label><Input type="number" value={item.gstPercent} onChange={e=>handleItemChange(idx, 'gstPercent', parseFloat(e.target.value))} className="h-9 text-xs"/></div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col"><span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-0.5">Batch</span><span className="text-sm font-bold">{item.batchNumber}</span></div>
                          <div className="flex flex-col"><span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-0.5">Expiry</span><span className="text-sm font-bold">{item.expiryDate}</span></div>
                          <div className="flex flex-col"><span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-0.5">Rate</span><span className="text-sm font-bold">₹{item.purchasePrice}</span></div>
                          <div className="flex flex-col"><span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-0.5">Quantity</span><span className="text-sm font-bold text-primary">{item.quantity} {item.freeQuantity > 0 && <span className="text-emerald-500 font-black">+{item.freeQuantity}</span>}</span></div>
                        </>
                      )}
                    </div>
                  </CardContent>
               </Card>
            ))}
         </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border z-50 lg:p-6 shadow-2xl">
         <div className="container max-w-4xl">
           <Button 
              className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 flex gap-2"
              disabled={isSaving}
              onClick={handleConfirm}
           >
              {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {isSaving ? 'Finalizing Stock...' : 'Confirm & Add to Inventory'}
           </Button>
         </div>
      </div>
    </div>
  );
}
