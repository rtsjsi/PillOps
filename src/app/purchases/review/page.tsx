'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { fetchUserProfile } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { CheckCircle2, ArrowLeft, Sparkles, AlertTriangle, Loader2, Save, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import GenericTableLoading from '@/components/ui/tableLoading';
import { toast } from 'sonner';
import { fetchMedicines, fetchGlobalMedicines } from '@/lib/queries';
import { checkAndEnrichInvoiceMedicines } from '@/app/medicines/actions';
import { getMatchScore, expandMedicineAbbreviations } from '@/hooks/use-medicine-search';
import { useDistinctValues } from '@/hooks/use-distinct-values';
import { addGlobalMedicine, fetchMedicineDetailsFromAI } from '@/app/medicines/actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GenericAutocomplete } from '@/components/ui/autocomplete';

// ─── Shared Components ────────────────────────────────────────
import { InvoiceHeaderCard, type InvoiceHeaderData } from '@/components/purchases/invoice-header-card';
import { PurchaseItemCard, type PurchaseItem } from '@/components/purchases/purchase-item-card';

interface InvoiceData extends InvoiceHeaderData {
  id?: string;
  items: PurchaseItem[];
  validationWarnings?: string[];
  duplicateWarning?: string;
}

export default function ReviewExtraction() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draftId');

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

  // ─── Item Change Handler (shared logic) ──────────────────────
  const handleItemChange = (idx: number, field: keyof PurchaseItem, value: any, fullItem?: any) => {
    if (!data) return;
    const newItems = [...data.items];
    const finalValue = field === 'medicineName' && typeof value === 'string' ? value.toUpperCase() : value;
    newItems[idx] = { ...newItems[idx], [field]: finalValue } as PurchaseItem;
    
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
    setData({ ...data, items: data.items.filter((_, i) => i !== idx) });
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

  // ─── Data Loading: Draft or OCR ──────────────────────────────
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
                         enrichedItem.matchStatus = bestMatch.score === 100 ? 'exact' : 'probable';
                      } else {
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

  // ─── Save / Confirm Handler ──────────────────────────────────
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

        if (error) {
          // Handle duplicate invoice error from the DB-level guard
          if (error.message?.includes('DUPLICATE_INVOICE')) {
            const cleanMsg = error.message.replace('DUPLICATE_INVOICE: ', '');
            toast.error(cleanMsg, { duration: 8000 });
            return;
          }
          throw new Error(error.message);
        }

        sessionStorage.removeItem('pillops_extracted_invoice');
        setIsSuccess(true);
        setTimeout(() => {
            router.push('/purchases');
        }, 2000);
    } catch (error: any) {
        console.error('Save failed:', error);
        const msg = error.message || 'Unknown error';
        if (msg.includes('DUPLICATE_INVOICE')) {
          toast.error(msg.replace('DUPLICATE_INVOICE: ', ''), { duration: 8000 });
        } else {
          toast.error(`Failed to save invoice: ${msg}`);
        }
    } finally {
        if (status === 'completed') setIsSaving(false);
        else setIsDrafting(false);
    }
  };

  // ─── AI Lookup Handler ───────────────────────────────────────
  const handleAILookup = async (idx: number) => {
    if (!data) return;
    setFetchingAI(prev => [...prev, idx]);
    try {
      const item = data.items[idx];
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
  };

  const handleConfirmMatch = (idx: number) => {
    if (!data) return;
    const newItems = [...data.items];
    newItems[idx].matchStatus = 'exact';
    setData({ ...data, items: newItems });
  };

  // ─── Add Medicine Dialog Handler ─────────────────────────────
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
       
       fetchMedicines().then(setMedicines);
    } catch(err: any) {
       toast.error(err.message);
    } finally {
       setIsAddingMedicine(false);
    }
  };

  // ─── Error State ─────────────────────────────────────────────
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

  // ─── Loading State ───────────────────────────────────────────
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

  // ─── Success State ───────────────────────────────────────────
  if (isSuccess) {
      return (
          <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-6 text-center">
              <CheckCircle2 size={80} className="text-emerald-500 animate-bounce" />
              <div className="grid gap-2">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Stock Added!</h2>
                <p className="text-muted-foreground font-medium">Inventory updated successfully. Redirecting...</p>
              </div>
          </div>
      );
  }

  // ─── Main Review UI ──────────────────────────────────────────
  return (
    <div className="container py-4 flex flex-col gap-4 pb-28">
      {/* Header Navigation */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link href="/purchases/scan" />} className="rounded-full">
              <ArrowLeft size={24} />
          </Button>
          <h1 className="text-lg font-bold tracking-tight">Review Invoice Data</h1>
        </div>
        <Button variant="outline" render={<Link href="/purchases/scan" />} className="font-bold rounded-full text-primary border-primary/20 bg-primary/5 hover:bg-primary/10">
          Rescan Invoice
        </Button>
      </header>

      {/* ─── Sticky Invoice Header ─── */}
      <InvoiceHeaderCard
        data={data}
        onChange={(field, value) => setData({ ...data, [field]: value })}
        invalidFields={invalidFields.header}
        distributors={distributors}
        warning={data.duplicateWarning}
        sticky
      />

      {/* ─── Items Section ─── */}
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

         <div className="flex flex-col gap-3">
            {data.items.map((item, idx) => (
              <PurchaseItemCard
                key={idx}
                item={item}
                index={idx}
                onChange={handleItemChange}
                onRemove={removeItem}
                medicines={medicines}
                manufacturers={manufacturers}
                canRemove={data.items.length > 1}
                hasError={invalidFields.items.includes(idx)}
                showMatchFeatures={!draftId}
                onAILookup={handleAILookup}
                onConfirmMatch={handleConfirmMatch}
                isAIFetching={fetchingAI.includes(idx)}
              />
            ))}
         </div>
      </div>

      {/* ─── Bottom Action Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-xl border-t border-border z-50 shadow-lg">
         <div className="container max-w-4xl flex flex-col sm:flex-row gap-2 sm:gap-3">
           <Button 
              variant="secondary"
              className="w-full sm:w-1/3 h-12 sm:h-11 text-sm font-bold rounded-xl shadow-md flex gap-2"
              disabled={isSaving || isDrafting}
              onClick={() => handleConfirm('draft')}
           >
              {isDrafting ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {isDrafting ? 'Saving...' : 'Save as Draft'}
           </Button>
           <Button 
              className="w-full sm:w-2/3 h-12 sm:h-11 text-sm font-bold rounded-xl shadow-lg shadow-primary/15 flex gap-2"
              disabled={isSaving || isDrafting}
              onClick={() => handleConfirm('completed')}
           >
              {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
              {isSaving ? 'Finalizing Stock...' : `Confirm & Add to Inventory (${data.items.length} items)`}
           </Button>
         </div>
      </div>

      {/* ─── Add Medicine Dialog ─── */}
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
