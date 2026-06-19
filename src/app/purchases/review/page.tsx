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
import { getMatchScore, expandMedicineAbbreviations } from '@/hooks/use-medicine-search';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDistinctValues } from '@/hooks/use-distinct-values';
import { GenericAutocomplete } from '@/components/ui/autocomplete';
import { addGlobalMedicine, fetchMedicineDetailsFromAI } from '@/app/medicines/actions';
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
    matchStatus?: 'exact' | 'probable' | 'none';
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
  const manufacturers = useDistinctValues('manufacturers', 'name', true);
  const distributors = useDistinctValues('distributors', 'name', false);
  
  const [isAddMedicineOpen, setIsAddMedicineOpen] = useState(false);
  const [newMedicine, setNewMedicine] = useState({ name: '', category: 'Tablet', manufacturer: '' });
  const [isAddingMedicine, setIsAddingMedicine] = useState(false);
  const [fetchingAI, setFetchingAI] = useState<number[]>([]);

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
          newItems[idx].matchStatus = 'exact';
       } else {
          newItems[idx].matchStatus = 'none';
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
      const processInvoice = async () => {
        try {
          const parsed = JSON.parse(rawData);
          
          const enrichedItems = await Promise.all(parsed.items.map(async (item: any) => {
             const extracted = item.medicineName;
             let enrichedItem = {
               ...item,
               extractedName: extracted,
               matchStatus: 'none' as 'exact' | 'probable' | 'none',
             };
             
             if (extracted) {
                try {
                   const cleanExtracted = expandMedicineAbbreviations(extracted);
                   let globals = await fetchGlobalMedicines(cleanExtracted);
                   
                   if (!globals || globals.length === 0) {
                      const firstWord = cleanExtracted.split(' ')[0];
                      if (firstWord && firstWord.length > 2) {
                         globals = await fetchGlobalMedicines(firstWord);
                      }
                   }

                   if (globals && globals.length > 0) {
                      const scored = globals.map((m: any) => {
                         const nScore = getMatchScore(cleanExtracted, m.name);
                         const gScore = getMatchScore(cleanExtracted, m.genericName || '');
                         return { item: m, score: Math.max(nScore, gScore) };
                      }).sort((a: any, b: any) => b.score - a.score);
                      
                      const bestMatch = scored[0];
                      if (bestMatch && bestMatch.score > 0) {
                         enrichedItem.medicineName = bestMatch.item.name;
                         enrichedItem.category = bestMatch.item.category || '';
                         enrichedItem.manufacturer = bestMatch.item.manufacturer || '';
                         // We DO NOT override hsnCode and gstPercent from global master
                         // We respect whatever was extracted (or undefined)
                         enrichedItem.matchStatus = bestMatch.score === 100 ? 'exact' : 'probable';
                      } else {
                         // No good match, clear category/manufacturer to force manual entry
                         enrichedItem.category = '';
                         enrichedItem.manufacturer = '';
                      }
                   } else {
                      enrichedItem.category = '';
                      enrichedItem.manufacturer = '';
                   }
                } catch (e) {
                   enrichedItem.category = '';
                   enrichedItem.manufacturer = '';
                }
             } else {
                enrichedItem.category = '';
                enrichedItem.manufacturer = '';
             }
             return enrichedItem;
          }));
          
          parsed.items = enrichedItems;
          setData(parsed);
        } catch (e) {
          setFatalError("Failed to parse extracted invoice data.");
        } finally {
          setIsEnriching(false);
        }
      };
      processInvoice();
    } else {
      setFatalError("No invoice data found. Please scan an invoice first.");
      setIsEnriching(false);
    }
  }, []);

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

        // Auto-insert any unmatched items to global_medicine_master
        if (status === 'completed') {
           const unmatchedItems = data.items.filter(item => item.matchStatus === 'none' && item.medicineName);
           if (unmatchedItems.length > 0) {
              await Promise.all(unmatchedItems.map(item => 
                 addGlobalMedicine({
                    name: item.medicineName,
                    category: item.category || 'Tablet',
                    manufacturer: item.manufacturer || 'Unknown'
                 }).catch(e => {
                    console.error("Failed to auto-insert to global master:", e);
                 })
              ));
           }
        }

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
               <Label className={cn("text-xs uppercase tracking-widest font-black text-muted-foreground", invalidFields.header.includes('distributorName') && "text-rose-500")}>Distributor</Label>
               <GenericAutocomplete
                 placeholder="Select or enter distributor..."
                 value={data.distributorName}
                 onValueChange={v => setData({ ...data, distributorName: v })}
                 options={distributors}
                 className={cn("h-12 text-base md:text-lg font-bold text-slate-900 bg-white", invalidFields.header.includes('distributorName') && "border-rose-500 ring-rose-500 focus-visible:ring-rose-500")}
               />
            </div>
            <div className="space-y-1 text-right">
               <Label className={cn("text-xs uppercase tracking-widest font-black text-muted-foreground", invalidFields.header.includes('invoiceDate') && "text-rose-500")}>Date</Label>
               <Input 
                 type="date"
                 value={data.invoiceDate} 
                 onChange={e => setData({ ...data, invoiceDate: e.target.value })} 
                 className={cn("h-12 text-base md:text-lg font-bold text-slate-900 bg-white text-right", invalidFields.header.includes('invoiceDate') && "border-rose-500 focus-visible:ring-rose-500")}
               />
            </div>
            <div className="space-y-1">
               <Label className={cn("text-xs uppercase tracking-widest font-black text-muted-foreground", invalidFields.header.includes('invoiceNumber') && "text-rose-500")}>Invoice Number</Label>
               <Input 
                 value={data.invoiceNumber} 
                 onChange={e => setData({ ...data, invoiceNumber: e.target.value })} 
                 className={cn("h-12 text-base md:text-lg font-bold text-primary bg-white", invalidFields.header.includes('invoiceNumber') && "border-rose-500 focus-visible:ring-rose-500")}
               />
            </div>
            <div className="space-y-1 text-right">
               <Label className="text-xs uppercase tracking-widest font-black text-muted-foreground">Net Amount</Label>
               <p className="text-3xl font-black text-emerald-600 tracking-tighter">{formatCurrency(data.total)}</p>
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
                
                let cardStyle = "ring-primary/20";
                let badgeStyle = "bg-primary";
                let statusMsg = null;
                
                if (hasError) {
                   cardStyle = "ring-rose-500/80 bg-rose-50/50";
                   badgeStyle = "bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]";
                } else if (item.matchStatus === 'none') {
                   cardStyle = "ring-rose-500/80 bg-rose-50/50";
                   badgeStyle = "bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]";
                   statusMsg = <span className="text-rose-500 font-bold bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={12} /> No Match Found</span>;
                } else if (item.matchStatus === 'probable') {
                   cardStyle = "ring-amber-500/80 bg-amber-50/50";
                   badgeStyle = "bg-amber-500";
                   statusMsg = <span className="text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={12} /> Probable Match</span>;
                } else if (item.matchStatus === 'exact') {
                   cardStyle = "ring-emerald-500/50 bg-emerald-50/30";
                   badgeStyle = "bg-emerald-500";
                   statusMsg = <span className="text-emerald-600 font-bold bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={12} /> Exact Match</span>;
                }

               return (
                <Card key={idx} className={cn("transition-all ring-2 border-primary/30", cardStyle)}>
                  <CardHeader className="p-2.5 md:p-3 flex flex-row items-start md:items-center gap-2 md:gap-3 space-y-0">
                    <span className={cn("text-white text-[9px] font-black w-5 h-5 mt-1 md:mt-0 flex items-center justify-center rounded-full shrink-0", badgeStyle)}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest gap-2 mb-1">
                          <div className="flex flex-wrap items-center gap-2 w-full">
                             {item.extractedName ? (
                               <div className="flex items-center gap-1">Extracted: <span className="text-primary truncate max-w-[150px] sm:max-w-[250px]" title={item.extractedName}>{item.extractedName}</span></div>
                             ) : 'Item Details'}
                             {statusMsg}
                             {item.matchStatus === 'probable' && (
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full shrink-0" onClick={() => {
                                   const newItems = [...data.items];
                                   newItems[idx].matchStatus = 'exact';
                                   setData({ ...data, items: newItems });
                                }}>✓ Confirm Match</Button>
                             )}
                             {(item.matchStatus === 'none' || item.matchStatus === 'probable') && (
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2.5 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-full shrink-0" onClick={async () => {
                                   setFetchingAI(prev => [...prev, idx]);
                                   try {
                                      const res = await fetchMedicineDetailsFromAI(item.extractedName || item.medicineName);
                                      if (res.data) {
                                         const newItems = [...data.items];
                                         newItems[idx].medicineName = res.data.name;
                                         newItems[idx].category = res.data.category;
                                         newItems[idx].manufacturer = res.data.manufacturer;
                                         setData({ ...data, items: newItems });
                                         toast.success("AI fetched details successfully!");
                                      } else {
                                         throw new Error(res.error);
                                      }
                                   } catch (e: any) {
                                      toast.error(e.message || "Failed to fetch details from AI");
                                   } finally {
                                      setFetchingAI(prev => prev.filter(i => i !== idx));
                                   }
                                }} disabled={fetchingAI.includes(idx)}>
                                   {fetchingAI.includes(idx) ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Sparkles size={12} className="mr-1" />}
                                   Ask AI
                                </Button>
                             )}
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
                       <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-rose-500 hover:bg-rose-50 rounded-full shrink-0 mt-1 md:mt-0 h-8 w-8">
                           <Trash2 size={14} />
                       </Button>
                    )}
                  </CardHeader>
                  
                  <CardContent className="p-2.5 md:p-3 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-x-3 gap-y-4">
                      <div className="space-y-1.5"><Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground">Category</Label>
                        <Select value={item.category || ''} onValueChange={(v) => handleItemChange(idx, 'category', v)}>
                          <SelectTrigger className="h-10 text-sm font-medium"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Sachet', 'OTC'].map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5"><Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground">Manufacturer</Label>
                        <GenericAutocomplete placeholder="e.g. Cipla" value={item.manufacturer || ''} onValueChange={v=>handleItemChange(idx, 'manufacturer', v)} options={manufacturers} className="h-10 text-sm font-medium"/>
                      </div>
                      <div className="space-y-1.5"><Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground">Batch</Label><Input value={item.batchNumber} onChange={e=>handleItemChange(idx, 'batchNumber', e.target.value)} className="h-10 text-sm font-medium"/></div>
                      <div className="space-y-1.5"><Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground">Exp (MM-YYYY)</Label><Input placeholder="12-2025" value={item.expiryDate} onChange={e=>{
                         let v = e.target.value.replace(/\D/g, '').substring(0, 6);
                         if (v.length >= 3) v = `${v.substring(0, 2)}-${v.substring(2, 6)}`;
                         handleItemChange(idx, 'expiryDate', v);
                      }} className="h-10 text-sm font-medium"/></div>
                      <div className="space-y-1.5"><Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground">Rate</Label><Input type="number" value={item.purchasePrice} onChange={e=>handleItemChange(idx, 'purchasePrice', parseFloat(e.target.value))} className="h-10 text-sm font-medium"/></div>
                      <div className="space-y-1.5"><Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground">MRP</Label><Input type="number" value={item.mrp} onChange={e=>handleItemChange(idx, 'mrp', parseFloat(e.target.value))} className="h-10 text-sm font-medium"/></div>
                      <div className="space-y-1.5"><Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground">Disc %</Label><Input type="number" value={item.discountPercent} onChange={e=>handleItemChange(idx, 'discountPercent', parseFloat(e.target.value))} className="h-10 text-sm font-medium"/></div>
                      <div className="space-y-1.5"><Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground">Qty</Label><Input type="number" value={item.quantity} onChange={e=>handleItemChange(idx, 'quantity', parseInt(e.target.value))} className="h-10 text-sm font-medium"/></div>
                      <div className="space-y-1.5"><Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground">Free</Label><Input type="number" value={item.freeQuantity} onChange={e=>handleItemChange(idx, 'freeQuantity', parseInt(e.target.value))} className="h-10 text-sm font-medium"/></div>
                      <div className="space-y-1.5"><Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground">GST %</Label><Input type="number" value={item.gstPercent} onChange={e=>handleItemChange(idx, 'gstPercent', parseFloat(e.target.value))} className="h-10 text-sm font-medium"/></div>
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

