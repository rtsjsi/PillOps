'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { fetchUserProfile } from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, cn } from '@/lib/utils';
import { CheckCircle2, ArrowLeft, Sparkles, Edit2, AlertTriangle, Loader2, Save, Trash2, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GenericTableLoading from '@/components/ui/tableLoading';
import { toast } from 'sonner';
import { MedicineAutocomplete } from '@/components/purchases/medicine-autocomplete';
import { fetchMedicines, fetchGlobalMedicines } from '@/lib/queries';
import { checkAndEnrichInvoiceMedicines } from '@/app/medicines/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDistinctValues } from '@/hooks/use-distinct-values';
import { GenericAutocomplete } from '@/components/ui/autocomplete';
import { addGlobalMedicine } from '@/app/medicines/actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger, DialogPortal, DialogOverlay } from '@/components/ui/dialog';

export default function ReviewExtraction() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draftId');

  interface InvoiceItem {
    medicineName: string;
    extractedName?: string;
    batchNumber: string;
    expiryDate: string;
    purchasePrice: number;
    mrp: number;
    discountPercent: number;
    quantity: number;
    freeQuantity: number;
    manufacturer?: string;
    category?: string;
    hsnCode?: string;
    gstPercent?: number;
    totalAmount?: number;
    isUnmatched?: boolean;
  }

  interface InvoiceData {
    id?: string;
    distributorName: string;
    invoiceDate: string;
    invoiceNumber: string;
    total: number;
    items: InvoiceItem[];
    validationWarnings?: string[];
  }

  const [data, setData] = useState<InvoiceData | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<{ header: string[], items: number[] }>({ header: [], items: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isEnriching, setIsEnriching] = useState(true);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [hasAutoMatched, setHasAutoMatched] = useState(false);
  const manufacturers = useDistinctValues('manufacturers', 'name', true);
  const distributors = useDistinctValues('distributors', 'name', false);
  
  const [isAddMedicineOpen, setIsAddMedicineOpen] = useState(false);
  const [newMedicine, setNewMedicine] = useState({ name: '', category: 'Tablet', manufacturer: '' });
  const [isAddingMedicine, setIsAddingMedicine] = useState(false);

  useEffect(() => {
    fetchMedicines().then(setMedicines);
  }, []);

  const handleItemChange = (idx: number, field: keyof InvoiceItem, value: any, fullItem?: any) => {
    if (!data) return;
    const newItems = [...data.items];
    const finalValue = field === 'medicineName' && typeof value === 'string' ? value.toUpperCase() : value;
    newItems[idx] = { ...newItems[idx], [field]: finalValue } as InvoiceItem;
    
    if (field === 'medicineName') {
       if (fullItem) {
          if (fullItem.gstPercent !== undefined) newItems[idx].gstPercent = fullItem.gstPercent;
          if (fullItem.manufacturer !== undefined) newItems[idx].manufacturer = fullItem.manufacturer;
          if (fullItem.hsnCode !== undefined) newItems[idx].hsnCode = fullItem.hsnCode;
          if (fullItem.category !== undefined) newItems[idx].category = fullItem.category;
          newItems[idx].isUnmatched = false;
       } else {
          newItems[idx].isUnmatched = true;
       }
    }
    
    if (field === 'mrp' || field === 'purchasePrice') {
       const mrp = field === 'mrp' ? value : newItems[idx].mrp || 0;
       const rate = field === 'purchasePrice' ? value : newItems[idx].purchasePrice || 0;
       if (mrp > 0 && rate > 0 && mrp >= rate) {
           newItems[idx].discountPercent = Number((((mrp - rate) / mrp) * 100).toFixed(2));
       }
    }
    
    // Auto-calc total
    if (['quantity', 'purchasePrice', 'gstPercent'].includes(field)) {
       const qty = field === 'quantity' ? value : newItems[idx].quantity || 0;
       const price = field === 'purchasePrice' ? value : newItems[idx].purchasePrice || 0;
       const gst = field === 'gstPercent' ? value : newItems[idx].gstPercent || 0;
       const base = qty * price;
       newItems[idx].totalAmount = base + (base * (gst / 100));
    }
    
    setData({ ...data, items: newItems });
  };

  const removeItem = (idx: number) => {
    if (!data || data.items.length === 1) return;
    const newItems = data.items.filter((_, i) => i !== idx);
    setData({ ...data, items: newItems });
  };

  const addItem = () => {
    if (!data) return;
    setData({
      ...data, 
      items: [...data.items, {
        medicineName: '', batchNumber: '', expiryDate: '', quantity: 1, freeQuantity: 0,
        purchasePrice: 0, mrp: 0, discountPercent: 0, gstPercent: 12, totalAmount: 0
      }]
    });
  };

  useEffect(() => {
    if (draftId) {
      const fetchDraft = async () => {
         try {
             const supabase = createClient();
             const { data: draft, error } = await supabase.from('purchase_invoices').select('*, purchase_invoice_items(*)').eq('id', draftId).single();
             
             if (error || !draft) throw new Error("Draft not found.");
             
             const mappedData: InvoiceData = {
                 id: draft.id,
                 distributorName: draft.distributor_name || '',
                 invoiceDate: draft.invoice_date || '',
                 invoiceNumber: draft.invoice_number || '',
                 total: draft.total || 0,
                 items: (draft.purchase_invoice_items || []).map((item: any) => ({
                     medicineName: item.medicine_name || '',
                     batchNumber: item.batch_number || '',
                     expiryDate: item.expiry_date || '',
                     purchasePrice: item.purchase_price || 0,
                     mrp: item.mrp || 0,
                     discountPercent: item.discount_percent || 0,
                     quantity: item.quantity || 0,
                     freeQuantity: item.free_quantity || 0,
                     gstPercent: item.gst_percent || 12,
                     totalAmount: item.total_amount || 0
                 }))
             };
             
             setData(mappedData);
         } catch (e: any) {
             console.error("Fetch draft error:", e);
             setFatalError(e.message || "Failed to load draft invoice.");
         } finally {
             setIsEnriching(false);
         }
      };
      fetchDraft();
      return;
    }

    const rawData = sessionStorage.getItem('pillops_extracted_invoice');
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        
        // Map the parsed items to store the original extracted name
        // Also clear out any OCR-extracted category or manufacturer
        parsed.items = parsed.items.map((item: any) => ({
           ...item,
           extractedName: item.medicineName,
           category: '',
           manufacturer: '',
        }));
        
        setData(parsed);
        setIsEnriching(false);

      } catch (e) {
        setFatalError("Failed to parse extracted invoice data.");
        setIsEnriching(false);
      }
    } else {
      setFatalError("No invoice data found. Please scan an invoice first.");
      setIsEnriching(false);
    }
  }, []);

  const getBestMedicineMatch = (query: string, allMedicines: any[]) => {
     if (!query) return null;
     const q = query.toLowerCase().trim();
     let match = allMedicines.find(m => m.name.toLowerCase().trim() === q);
     if (match) return match;
     match = allMedicines.find(m => m.name.toLowerCase().trim().startsWith(q) || q.startsWith(m.name.toLowerCase().trim()));
     if (match) return match;
     match = allMedicines.find(m => m.name.toLowerCase().trim().includes(q) || q.includes(m.name.toLowerCase().trim()));
     return match || null;
  };

  useEffect(() => {
    if (!hasAutoMatched && data?.items && medicines.length > 0 && !draftId) {
      const runAutoMatch = async () => {
         const newItems = await Promise.all(data.items.map(async (item: any) => {
            if (item.medicineName === item.extractedName && item.extractedName) {
               try {
                  const globals = await fetchGlobalMedicines(item.extractedName);
                  if (globals && globals.length > 0) {
                     const match = getBestMedicineMatch(item.extractedName, globals) || globals[0];
                     return {
                        ...item,
                        medicineName: match.name,
                        category: match.category || '',
                        manufacturer: match.manufacturer || '',
                        hsnCode: item.hsnCode || match.hsnCode,
                        gstPercent: item.gstPercent !== undefined && item.gstPercent !== null ? item.gstPercent : match.gstPercent,
                        isUnmatched: false,
                     }
                  }
               } catch (e) {
                  // ignore
               }
               return { ...item, isUnmatched: true };
            }
            return item;
         }));
         setData({ ...data, items: newItems });
         setHasAutoMatched(true);
      };
      runAutoMatch();
    }
  }, [data, medicines, draftId, hasAutoMatched]);

  const handleConfirm = async (status: 'draft' | 'completed' = 'completed') => {
    if (!data || isSaving || isDrafting) return;

    setInvalidFields({ header: [], items: [] });
    let headerErrors: string[] = [];
    let itemErrors: number[] = [];

    // Validation
    if (!data.distributorName) headerErrors.push('distributorName');
    if (!data.invoiceNumber) headerErrors.push('invoiceNumber');
    
    if (status === 'completed') {
      if (!data.invoiceDate) headerErrors.push('invoiceDate');
      
      data.items.forEach((item, idx) => {
        let isInvalid = false;
        if (
            !item.medicineName || !item.batchNumber || !item.expiryDate ||
            item.quantity === undefined || item.quantity === null || isNaN(item.quantity) ||
            item.purchasePrice === undefined || item.purchasePrice === null || isNaN(item.purchasePrice) ||
            item.mrp === undefined || item.mrp === null || isNaN(item.mrp) ||
            item.discountPercent === undefined || item.discountPercent === null || isNaN(item.discountPercent) ||
            item.freeQuantity === undefined || item.freeQuantity === null || isNaN(item.freeQuantity) ||
            item.gstPercent === undefined || item.gstPercent === null || isNaN(item.gstPercent)
        ) {
          isInvalid = true;
        }
        
        // Simple MM-YYYY format validation
        if (!/^(0[1-9]|1[0-2])-\d{4}$/.test(item.expiryDate)) {
          isInvalid = true;
        }

        // Validate medicine is in global master
        const isValidMedicine = medicines.some(m => m.name === item.medicineName);
        if (!isValidMedicine) {
          isInvalid = true;
          toast.error(`Medicine '${item.medicineName}' on row ${idx+1} is not in global master. Please add it first.`);
        }

        if (isInvalid) {
          itemErrors.push(idx);
        }
      });
    }

    if (headerErrors.length > 0 || itemErrors.length > 0) {
      setInvalidFields({ header: headerErrors, items: itemErrors });
      if (status === 'completed') {
        toast.error("Please fill in all highlighted mandatory fields correctly.");
        return;
      } else {
        toast.info("Saved as Draft with some missing or invalid fields.");
      }
    }

    if (status === 'completed') setIsSaving(true);
    else setIsDrafting(true);

    try {
        const profile = await fetchUserProfile();
        if (!profile?.store_id) throw new Error("Store ID not found");

        // Format MM-YYYY to YYYY-MM for the database if strictly matched
        const formattedItems = data.items.map(item => {
           let expiry = item.expiryDate;
           if (/^(0[1-9]|1[0-2])-\d{4}$/.test(item.expiryDate)) {
             const [mm, yyyy] = item.expiryDate.split('-');
             expiry = `${yyyy}-${mm}`;
           }
           return { ...item, expiryDate: expiry };
        });

        const supabase = createClient();
        const { error } = await supabase.rpc('save_purchase_invoice', {
          purchase_data: { ...data, storeId: profile.store_id, status },
          items: formattedItems,
        });

        if (error) throw new Error(error.message);

        sessionStorage.removeItem('pillops_extracted_invoice');
        setIsSuccess(true);
        setTimeout(() => {
            router.push('/purchases');
        }, 2000);
    } catch (error: any) {
        console.error('Save failed:', error);
        toast.error(`Failed to save invoice: ${error.message || 'Unknown error'}`);
    } finally {
        if (status === 'completed') setIsSaving(false);
        else setIsDrafting(false);
    }
  };

  const handleAddMedicine = async () => {
    if (!newMedicine.name || !newMedicine.category || !newMedicine.manufacturer) {
       toast.error('Name, Category, and Manufacturer are mandatory.');
       return;
    }
    setIsAddingMedicine(true);
    try {
       const res = await addGlobalMedicine(newMedicine);
       if (res.error) throw new Error(res.error);
       
       toast.success('Medicine added! The AI has enriched it with additional details.');
       setIsAddMedicineOpen(false);
       setNewMedicine({ name: '', category: 'Tablet', manufacturer: '' });
       
       // Refresh medicine list
       fetchMedicines().then(setMedicines);
    } catch(err: any) {
       toast.error(err.message);
    } finally {
       setIsAddingMedicine(false);
    }
  };

  if (fatalError) {
     return (
        <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-6 text-center">
           <AlertTriangle size={64} className="text-red-500 bg-red-500/10 p-4 rounded-full" />
           <div className="grid gap-2">
             <h2 className="text-2xl font-bold">Extraction Error</h2>
             <p className="text-muted-foreground">{fatalError}</p>
           </div>
           <Button render={<Link href="/purchases/scan" />} size="lg" className="mt-4">
             Try Again
           </Button>
        </div>
     );
  }

  if (isEnriching || !data) {
    return (
       <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-6 text-center">
          <Sparkles size={64} className="text-primary animate-pulse" />
          <div className="grid gap-2">
            <h2 className="text-2xl font-bold">Enriching Medicine Data...</h2>
            <p className="text-muted-foreground">Checking Global Medicine Master and AI for missing details to save your time.</p>
          </div>
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mt-4" />
       </div>
    );
  }

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
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link href="/purchases/scan" />} className="rounded-full">
              <ArrowLeft size={24} />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Review Invoice Data</h1>
        </div>
        <Button variant="outline" render={<Link href="/purchases/scan" />} className="font-bold rounded-full text-primary border-primary/20 bg-primary/5 hover:bg-primary/10">
          Rescan Invoice
        </Button>
      </header>

      <Card className="bg-primary/5 border-primary/20 overflow-hidden shadow-xl shadow-primary/5">
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
            <div className="space-y-1">
               <Label className={cn("text-[10px] uppercase tracking-widest text-muted-foreground", invalidFields.header.includes('distributorName') && "text-rose-500")}>Distributor</Label>
               <GenericAutocomplete
                 placeholder="Select or enter distributor..."
                 value={data.distributorName}
                 onValueChange={v => setData({ ...data, distributorName: v })}
                 options={distributors}
                 className={cn("h-11 text-lg font-bold text-slate-900 bg-white", invalidFields.header.includes('distributorName') && "border-rose-500 ring-rose-500 focus-visible:ring-rose-500")}
               />
            </div>
            <div className="space-y-1 text-right">
               <Label className={cn("text-[10px] uppercase tracking-widest text-muted-foreground", invalidFields.header.includes('invoiceDate') && "text-rose-500")}>Date</Label>
               <Input 
                 type="date"
                 value={data.invoiceDate} 
                 onChange={e => setData({ ...data, invoiceDate: e.target.value })} 
                 className={cn("text-lg font-bold text-slate-900 bg-white text-right", invalidFields.header.includes('invoiceDate') && "border-rose-500 focus-visible:ring-rose-500")}
               />
            </div>
            <div className="space-y-1">
               <Label className={cn("text-[10px] uppercase tracking-widest text-muted-foreground", invalidFields.header.includes('invoiceNumber') && "text-rose-500")}>Invoice Number</Label>
               <Input 
                 value={data.invoiceNumber} 
                 onChange={e => setData({ ...data, invoiceNumber: e.target.value })} 
                 className={cn("text-lg font-bold text-primary bg-white", invalidFields.header.includes('invoiceNumber') && "border-rose-500 focus-visible:ring-rose-500")}
               />
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
             <div className="flex gap-2">
                 <Button variant="secondary" size="sm" onClick={() => setIsAddMedicineOpen(true)} className="rounded-full font-bold">
                     <Plus size={16} className="mr-2" /> Add Missing Medicine
                 </Button>
                 <Button variant="outline" size="sm" onClick={addItem} className="rounded-full font-bold text-primary border-primary/20">
                     <Plus size={16} className="mr-2" /> Add Row
                 </Button>
             </div>
         </div>
         

         <div className="flex flex-col gap-4">
              {data.items.map((item: any, idx: number) => {
                const hasError = invalidFields.items.includes(idx);
                const showHighlight = hasError || item.isUnmatched;

               return (
                <Card key={idx} className={cn("transition-all ring-2 border-primary/30", showHighlight ? "ring-rose-500/80 bg-rose-50/50" : "ring-primary/20")}>
                  <CardHeader className="p-4 flex flex-row items-center gap-4 space-y-0">
                    <span className={cn("text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0", showHighlight ? "bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]" : "bg-primary")}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest gap-1">
                          <div className="flex items-center gap-2">
                             {item.extractedName ? (
                               <>Extracted: <span className="text-primary truncate max-w-[200px]">{item.extractedName}</span></>
                             ) : 'Item Details'}
                             {item.isUnmatched && <span className="text-rose-500 font-bold bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={12} /> No Global Match Found</span>}
                          </div>
                       </div>
                      <MedicineAutocomplete 
                        required
                        value={item.medicineName} 
                        onChange={(val, fullItem) => handleItemChange(idx, 'medicineName', val, fullItem)}
                        medicines={medicines}
                      />
                    </div>
                    {data.items.length > 1 && (
                       <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-rose-500 hover:bg-rose-50 rounded-full shrink-0">
                           <Trash2 size={16} />
                       </Button>
                    )}
                  </CardHeader>
                  
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Category</Label>
                        <Select value={item.category || ''} onValueChange={(v) => handleItemChange(idx, 'category', v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Sachet', 'OTC'].map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Manufacturer</Label>
                        <GenericAutocomplete placeholder="e.g. Cipla" value={item.manufacturer || ''} onValueChange={v=>handleItemChange(idx, 'manufacturer', v)} options={manufacturers} className="h-9 text-xs"/>
                      </div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Batch</Label><Input value={item.batchNumber} onChange={e=>handleItemChange(idx, 'batchNumber', e.target.value)} className="h-9 text-xs"/></div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Exp (MM-YYYY)</Label><Input placeholder="12-2025" value={item.expiryDate} onChange={e=>{
                         let v = e.target.value.replace(/\D/g, '').substring(0, 6);
                         if (v.length >= 3) v = `${v.substring(0, 2)}-${v.substring(2, 6)}`;
                         handleItemChange(idx, 'expiryDate', v);
                      }} className="h-9 text-xs"/></div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Rate</Label><Input type="number" value={item.purchasePrice} onChange={e=>handleItemChange(idx, 'purchasePrice', parseFloat(e.target.value))} className="h-9 text-xs"/></div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">MRP</Label><Input type="number" value={item.mrp} onChange={e=>handleItemChange(idx, 'mrp', parseFloat(e.target.value))} className="h-9 text-xs"/></div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Disc %</Label><Input type="number" value={item.discountPercent} onChange={e=>handleItemChange(idx, 'discountPercent', parseFloat(e.target.value))} className="h-9 text-xs"/></div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Qty</Label><Input type="number" value={item.quantity} onChange={e=>handleItemChange(idx, 'quantity', parseInt(e.target.value))} className="h-9 text-xs"/></div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Free</Label><Input type="number" value={item.freeQuantity} onChange={e=>handleItemChange(idx, 'freeQuantity', parseInt(e.target.value))} className="h-9 text-xs"/></div>
                      <div className="space-y-1.5"><Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">GST %</Label><Input type="number" value={item.gstPercent} onChange={e=>handleItemChange(idx, 'gstPercent', parseFloat(e.target.value))} className="h-9 text-xs"/></div>
                    </div>
                  </CardContent>
               </Card>
               );
            })}
         </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border z-50 lg:p-6 shadow-2xl">
         <div className="container max-w-4xl flex gap-4">
           <Button 
              variant="secondary"
              className="w-1/3 h-14 text-lg font-bold rounded-2xl shadow-xl shadow-slate-200 flex gap-2"
              disabled={isSaving || isDrafting}
              onClick={() => handleConfirm('draft')}
           >
              {isDrafting ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {isDrafting ? 'Saving...' : 'Save as Draft'}
           </Button>
           <Button 
              className="w-2/3 h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 flex gap-2"
              disabled={isSaving || isDrafting}
              onClick={() => handleConfirm('completed')}
           >
              {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
              {isSaving ? 'Finalizing Stock...' : 'Confirm & Add to Inventory'}
           </Button>
         </div>
      </div>

      <Dialog open={isAddMedicineOpen} onOpenChange={setIsAddMedicineOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Missing Medicine</DialogTitle>
            <DialogDescription>
              Add a medicine to the global master. Our AI will automatically enrich missing details like HSN, GST, and ingredients.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="med-name" className="text-xs uppercase tracking-wider font-bold">Medicine Name</Label>
              <Input
                id="med-name"
                placeholder="e.g. Dolo 650"
                value={newMedicine.name}
                onChange={(e) => setNewMedicine({ ...newMedicine, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="med-category" className="text-xs uppercase tracking-wider font-bold">Category</Label>
              <Select value={newMedicine.category} onValueChange={(v) => setNewMedicine({ ...newMedicine, category: v || 'Tablet' })}>
                <SelectTrigger id="med-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Sachet', 'OTC'].map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="med-manufacturer" className="text-xs uppercase tracking-wider font-bold">Manufacturer</Label>
              <GenericAutocomplete
                placeholder="e.g. Micro Labs"
                value={newMedicine.manufacturer}
                onValueChange={(v) => setNewMedicine({ ...newMedicine, manufacturer: v })}
                options={manufacturers}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={isAddingMedicine} onClick={handleAddMedicine} className="w-full rounded-full font-bold">
              {isAddingMedicine ? <Loader2 className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />}
              {isAddingMedicine ? 'Enriching & Saving...' : 'Save & Enrich'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

