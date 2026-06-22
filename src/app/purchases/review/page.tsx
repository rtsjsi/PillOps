'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { fetchUserProfile } from '@/lib/queries';
import { CheckCircle2, ArrowLeft, Sparkles, AlertTriangle, Loader2, Save, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fetchMedicines, fetchGlobalMedicines, fetchAliasesForDistributor } from '@/lib/queries';
import { getMatchScore, expandMedicineAbbreviations } from '@/hooks/use-medicine-search';
import { useDistinctValues } from '@/hooks/use-distinct-values';

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEnriching, setIsEnriching] = useState(true);
  
  const [medicines, setMedicines] = useState<any[]>([]);

  const handleDeleteDraft = async () => {
    if (!draftId) return;
    if (!window.confirm("Are you sure you want to delete this draft invoice?")) return;
    
    setIsDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('purchase_invoices').delete().eq('id', draftId);
      
      if (error) throw error;
      
      toast.success("Draft invoice deleted successfully.");
      sessionStorage.removeItem('pillops_extracted_invoice');
      router.push('/purchases');
    } catch (err: any) {
      console.error("Failed to delete draft:", err);
      toast.error(err.message || "Failed to delete draft invoice.");
    } finally {
      setIsDeleting(false);
    }
  };
  const manufacturers = useDistinctValues('manufacturers', 'name', true);
  const distributors = useDistinctValues('distributors', 'name', false);

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
        medicineName: '', extractedName: '', batchNumber: '', expiryDate: '', quantity: 1, freeQuantity: 0,
        purchasePrice: 0, mrp: 0, discountPercent: 0, gstPercent: 5, totalAmount: 0
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
                     expiryDate: (() => {
                       const date = item.expiry_date || '';
                       if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                         const [yyyy, mm] = date.split('-');
                         return `${mm}-${yyyy}`;
                       }
                       if (/^\d{4}-\d{2}$/.test(date)) {
                         const [yyyy, mm] = date.split('-');
                         return `${mm}-${yyyy}`;
                       }
                       return date;
                     })(),
                     purchasePrice: item.purchase_price || 0,
                     mrp: item.mrp || 0,
                     discountPercent: item.discount_percent || 0,
                     quantity: item.quantity || 0,
                     freeQuantity: item.free_quantity || 0,
                     gstPercent: item.gst_percent || 5,
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
          
          // ─── Smart Aliasing ───
          const aliases = await fetchAliasesForDistributor(parsed.distributorName);
          const aliasMap = new Map<string, any>();
          aliases.forEach((a: any) => aliasMap.set(a.ocrName, a));
          
          const enrichedItems = await Promise.all(parsed.items.map(async (item: any) => {
             const extracted = item.medicineName;
             let enrichedItem = { 
               ...item, 
               extractedName: extracted,
               discountPercent: item.discountPercent === undefined || item.discountPercent === null || isNaN(Number(item.discountPercent)) ? 0 : Number(item.discountPercent),
               freeQuantity: item.freeQuantity === undefined || item.freeQuantity === null || isNaN(Number(item.freeQuantity)) ? 0 : Number(item.freeQuantity),
               gstPercent: item.gstPercent === undefined || item.gstPercent === null || isNaN(Number(item.gstPercent)) ? 5 : Number(item.gstPercent),
               quantity: item.quantity === undefined || item.quantity === null || isNaN(Number(item.quantity)) ? 1 : Number(item.quantity),
               purchasePrice: item.purchasePrice === undefined || item.purchasePrice === null || isNaN(Number(item.purchasePrice)) ? 0 : Number(item.purchasePrice),
               mrp: item.mrp === undefined || item.mrp === null || isNaN(Number(item.mrp)) ? 0 : Number(item.mrp),
               expiryDate: (() => {
                 const expiry = item.expiryDate || '';
                 const clean = expiry.trim();
                 
                 // YYYY-MM-DD
                 if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
                   const [yyyy, mm] = clean.split('-');
                   return `${mm}-${yyyy}`;
                 }
                 // YYYY-MM
                 if (/^\d{4}-\d{2}$/.test(clean)) {
                   const [yyyy, mm] = clean.split('-');
                   return `${mm}-${yyyy}`;
                 }
                 // MM/YYYY or MM-YYYY
                 if (/^(0[1-9]|1[0-2])[-/]\d{4}$/.test(clean)) {
                   return clean.replace('/', '-');
                 }
                 // MM/YY or MM-YY
                 if (/^(0[1-9]|1[0-2])[-/]\d{2}$/.test(clean)) {
                   const parts = clean.split(/[-/]/);
                   return `${parts[0]}-20${parts[1]}`;
                 }
                 return clean;
               })()
             }; // Save original OCR name
             
             if (extracted) {
                // Check for learned alias first!
                const learnedAlias = aliasMap.get(extracted);
                if (learnedAlias) {
                   enrichedItem.medicineName = learnedAlias.medicineName;
                   enrichedItem.category = learnedAlias.category || 'Tablet';
                   enrichedItem.manufacturer = learnedAlias.manufacturer || '';
                   return enrichedItem;
                }

                // Fallback to fuzzy search if no alias exists
                try {
                   const cleanExtracted = expandMedicineAbbreviations(extracted);
                   enrichedItem.medicineName = cleanExtracted.toUpperCase(); // Default to cleaned OCR
                   
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
                      // Auto-fill details if it's a very strong match
                      if (bestMatch && bestMatch.score > 80) {
                         enrichedItem.medicineName = bestMatch.item.name;
                         enrichedItem.category = bestMatch.item.category || '';
                         enrichedItem.manufacturer = bestMatch.item.manufacturer || '';
                      } else {
                         enrichedItem.category = 'Tablet'; // sensible default
                         enrichedItem.manufacturer = '';
                      }
                   } else {
                      enrichedItem.category = 'Tablet';
                      enrichedItem.manufacturer = '';
                   }
                } catch (e) {
                   // Fallback on error
                   enrichedItem.medicineName = extracted.toUpperCase();
                   enrichedItem.category = 'Tablet';
                   enrichedItem.manufacturer = '';
                }
             } else {
                enrichedItem.medicineName = '';
                enrichedItem.category = 'Tablet';
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
            !item.medicineName || item.medicineName.trim().length < 3 || 
            !item.batchNumber || !item.expiryDate ||
            item.quantity === undefined || item.quantity === null || isNaN(item.quantity) ||
            item.purchasePrice === undefined || item.purchasePrice === null || isNaN(item.purchasePrice) ||
            item.mrp === undefined || item.mrp === null || isNaN(item.mrp)
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

        // Format MM-YYYY to YYYY-MM for the database
        const formattedItems = data.items.map(item => {
           let expiry = item.expiryDate;
           if (/^(0[1-9]|1[0-2])-\d{4}$/.test(item.expiryDate)) {
             const [mm, yyyy] = item.expiryDate.split('-');
             expiry = `${yyyy}-${mm}`;
           }
           
           // Normalize/default numeric fields to ensure database integrity
           const discountPercent = item.discountPercent === undefined || item.discountPercent === null || isNaN(item.discountPercent) ? 0 : item.discountPercent;
           const freeQuantity = item.freeQuantity === undefined || item.freeQuantity === null || isNaN(item.freeQuantity) ? 0 : item.freeQuantity;
           const gstPercent = item.gstPercent === undefined || item.gstPercent === null || isNaN(item.gstPercent) ? 5 : item.gstPercent;
           
           return { 
             ...item, 
             expiryDate: expiry,
             discountPercent,
             freeQuantity,
             gstPercent
           };
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
            <h2 className="text-2xl font-bold">Processing Invoice...</h2>
            <p className="text-muted-foreground">Mapping extracted data to your inventory.</p>
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
          <Button variant="ghost" size="icon" render={<Link href="/purchases" />} className="rounded-full">
              <ArrowLeft size={24} />
          </Button>
          <h1 className="text-lg font-bold tracking-tight">Review Invoice Data</h1>
        </div>
        <div className="flex items-center gap-2">
          {draftId && (
            <Button
              variant="outline"
              disabled={isSaving || isDrafting || isDeleting}
              onClick={handleDeleteDraft}
              className="font-bold rounded-full text-rose-500 border-rose-200 bg-rose-50/20 hover:bg-rose-50 hover:text-rose-600"
            >
              {isDeleting ? 'Deleting...' : 'Delete Draft'}
            </Button>
          )}
          <Button variant="outline" render={<Link href="/purchases/scan" />} className="font-bold rounded-full text-primary border-primary/20 bg-primary/5 hover:bg-primary/10">
            Rescan Invoice
          </Button>
        </div>
      </header>

      {/* ─── Sticky Invoice Header ─── */}
      <InvoiceHeaderCard
        data={data}
        onChange={(field, value) => setData({ ...data, [field]: value })}
        invalidFields={invalidFields.header}
        distributors={distributors}
        warning={data.duplicateWarning}
      />

      {/* ─── Items Section ─── */}
      <div>
         <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-bold tracking-tight">Extracted Items ({data.items.length})</h2>
             <Button variant="outline" size="sm" onClick={addItem} className="rounded-full font-bold text-primary border-primary/20 bg-primary/5 hover:bg-primary/10">
                 <Plus size={16} className="mr-2" /> Add Row
             </Button>
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
    </div>
  );
}
