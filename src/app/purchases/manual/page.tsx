'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { fetchUserProfile, fetchMedicines } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Save, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useDistinctValues } from '@/hooks/use-distinct-values';
import { toast } from 'sonner';
import {
  calculatePurchaseLineAmount,
  calculatePurchaseTotals,
  PURCHASE_LINE_TOTAL_FIELDS,
} from '@/lib/purchase-calculations';

import { InvoiceHeaderCard, type InvoiceHeaderData } from '@/components/purchases/invoice-header-card';
import { PurchaseItemCard, type PurchaseItem } from '@/components/purchases/purchase-item-card';

function formatExpiryForForm(date: string): string {
  if (!date) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [yyyy, mm] = date.split('-');
    return `${mm}-${yyyy}`;
  }
  if (/^\d{4}-\d{2}$/.test(date)) {
    const [yyyy, mm] = date.split('-');
    return `${mm}-${yyyy}`;
  }
  return date;
}

function mapDbInvoiceToForm(draft: any): { invoiceData: InvoiceHeaderData & { id?: string }; items: PurchaseItem[] } {
  return {
    invoiceData: {
      id: draft.id,
      distributorName: draft.distributor_name || '',
      invoiceDate: draft.invoice_date || '',
      invoiceNumber: draft.invoice_number || '',
      total: draft.total || 0,
    },
    items: (draft.purchase_invoice_items || []).map((item: any) => ({
      medicineName: item.medicine_name || '',
      batchNumber: item.batch_number || '',
      expiryDate: formatExpiryForForm(item.expiry_date || ''),
      purchasePrice: item.purchase_price || 0,
      mrp: item.mrp || 0,
      discountPercent: item.discount_percent || 0,
      quantity: item.quantity || 0,
      freeQuantity: item.free_quantity || 0,
      gstPercent: item.gst_percent ?? 5,
      totalAmount: item.total_amount || 0,
      manufacturer: item.manufacturer || '',
      category: item.category || '',
    })),
  };
}

function ManualPurchaseEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('invoiceId') || searchParams.get('draftId');

  const distributors = useDistinctValues('purchase_invoices', 'distributor_name');
  const manufacturers = useDistinctValues('manufacturers', 'name', true);

  const [isSaving, setIsSaving] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!invoiceId);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'draft' | 'completed' | null>(null);
  const [invalidFields, setInvalidFields] = useState<{ header: string[]; items: number[] }>({
    header: [],
    items: [],
  });

  const [invoiceData, setInvoiceData] = useState<InvoiceHeaderData & { id?: string }>({
    distributorName: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    total: 0,
  });

  const [items, setItems] = useState<PurchaseItem[]>([
    {
      medicineName: '', category: '', manufacturer: '',
      batchNumber: '', expiryDate: '', quantity: 1, freeQuantity: 0,
      purchasePrice: 0, mrp: 0, discountPercent: 0, gstPercent: 5, totalAmount: 0,
    },
  ]);

  const [medicines, setMedicines] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    fetchMedicines().then(setMedicines);
  }, []);

  useEffect(() => {
    if (invoiceId) {
      const fetchExistingInvoice = async () => {
        try {
          const supabase = createClient();
          const { data: invoice, error: fetchError } = await supabase
            .from('purchase_invoices')
            .select('*, purchase_invoice_items(*)')
            .eq('id', invoiceId)
            .single();

          if (fetchError || !invoice) throw new Error('Invoice not found.');

          setEditStatus(invoice.status === 'draft' ? 'draft' : 'completed');
          const mapped = mapDbInvoiceToForm(invoice);
          setInvoiceData(mapped.invoiceData);
          setItems(mapped.items.length > 0 ? mapped.items : [{
            medicineName: '', category: '', manufacturer: '',
            batchNumber: '', expiryDate: '', quantity: 1, freeQuantity: 0,
            purchasePrice: 0, mrp: 0, discountPercent: 0, gstPercent: 5, totalAmount: 0,
          }]);
        } catch (err: any) {
          setError(err.message || 'Failed to load invoice.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchExistingInvoice();
      return;
    }

    const draft = sessionStorage.getItem('manual_purchase_draft');
    if (draft) {
      try {
        const data = JSON.parse(draft);
        if (data.invoiceData) setInvoiceData(data.invoiceData);
        if (data.items?.length) setItems(data.items);
      } catch {
        /* ignore corrupt session draft */
      }
    }
    setIsLoading(false);
  }, [invoiceId]);

  useEffect(() => {
    if (isClient && !invoiceId) {
      sessionStorage.setItem('manual_purchase_draft', JSON.stringify({ invoiceData, items }));
    }
  }, [invoiceData, items, isClient, invoiceId]);

  const handleItemChange = (idx: number, field: keyof PurchaseItem, value: any, fullItem?: any) => {
    const newItems = [...items];
    (newItems[idx] as any)[field] = value;

    if (field === 'medicineName' && fullItem) {
      if (fullItem.gstPercent !== undefined) newItems[idx].gstPercent = fullItem.gstPercent;
      if (fullItem.manufacturer !== undefined) newItems[idx].manufacturer = fullItem.manufacturer;
      if (fullItem.hsnCode !== undefined) newItems[idx].hsnCode = fullItem.hsnCode;
      if (fullItem.category !== undefined) newItems[idx].category = fullItem.category;
    }

    if ((PURCHASE_LINE_TOTAL_FIELDS as readonly string[]).includes(field)) {
      const line = calculatePurchaseLineAmount(newItems[idx]);
      newItems[idx].totalAmount = line.totalAmount;
    }

    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      medicineName: '', category: '', manufacturer: '',
      batchNumber: '', expiryDate: '', quantity: 1, freeQuantity: 0,
      purchasePrice: 0, mrp: 0, discountPercent: 0, gstPercent: 5, totalAmount: 0,
    }]);
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleDeleteDraft = async () => {
    if (!invoiceId || editStatus !== 'draft') return;
    if (!window.confirm('Are you sure you want to delete this draft invoice?')) return;

    setIsDeleting(true);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase.from('purchase_invoices').delete().eq('id', invoiceId);
      if (deleteError) throw deleteError;

      sessionStorage.removeItem('manual_purchase_draft');
      toast.success('Draft invoice deleted successfully.');
      router.push('/purchases');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete draft invoice.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async (status: 'draft' | 'completed' = 'completed') => {
    if (isSaving || isDrafting) return;

    setInvalidFields({ header: [], items: [] });
    const headerErrors: string[] = [];
    const itemErrors: number[] = [];

    if (!invoiceData.distributorName) headerErrors.push('distributorName');
    if (!invoiceData.invoiceNumber) headerErrors.push('invoiceNumber');

    const totals = calculatePurchaseTotals(items);

    if (status === 'completed') {
      if (!invoiceData.invoiceDate) headerErrors.push('invoiceDate');
      if (!totals.total || totals.total <= 0) headerErrors.push('total');

      items.forEach((item, idx) => {
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
        if (isInvalid) itemErrors.push(idx);
      });
    }

    if (headerErrors.length > 0 || itemErrors.length > 0) {
      setInvalidFields({ header: headerErrors, items: itemErrors });
      if (status === 'completed') {
        toast.error('Please fill in all highlighted mandatory fields correctly.');
        return;
      }
      toast.info('Saved as Draft with some missing or invalid fields.');
    }

    setError(null);
    if (status === 'completed') setIsSaving(true);
    else setIsDrafting(true);

    try {
      const formattedItems = items.map((item) => {
        let expiry = item.expiryDate;
        if (/^(0[1-9]|1[0-2])-\d{4}$/.test(item.expiryDate)) {
          const [mm, yyyy] = item.expiryDate.split('-');
          expiry = `${yyyy}-${mm}`;
        }

        const line = calculatePurchaseLineAmount(item);
        const discountPercent = item.discountPercent === undefined || item.discountPercent === null || isNaN(item.discountPercent) ? 0 : item.discountPercent;
        const freeQuantity = item.freeQuantity === undefined || item.freeQuantity === null || isNaN(item.freeQuantity) ? 0 : item.freeQuantity;
        const gstPercent = item.gstPercent === undefined || item.gstPercent === null || isNaN(item.gstPercent) ? 5 : item.gstPercent;

        return {
          ...item,
          expiryDate: expiry,
          discountPercent,
          freeQuantity,
          gstPercent,
          totalAmount: line.totalAmount,
        };
      });

      const profile = await fetchUserProfile();
      if (!profile?.store_id) throw new Error('Store ID not found');

      const purchasePayload = {
        id: invoiceData.id,
        distributorName: invoiceData.distributorName,
        invoiceDate: invoiceData.invoiceDate,
        invoiceNumber: invoiceData.invoiceNumber,
        ...totals,
        total: totals.total,
        storeId: profile.store_id,
        status,
      };

      const supabase = createClient();
      const { error: saveError } = await supabase.rpc('save_purchase_invoice', {
        purchase_data: purchasePayload,
        items: formattedItems,
      });

      if (saveError) {
        if (saveError.message?.includes('DUPLICATE_INVOICE')) {
          const cleanMsg = saveError.message.replace('DUPLICATE_INVOICE: ', '');
          toast.error(cleanMsg, { duration: 8000 });
          return;
        }
        throw new Error(saveError.message);
      }

      sessionStorage.removeItem('manual_purchase_draft');

      if (status === 'draft') {
        toast.success('Draft saved successfully.');
        router.push('/purchases');
        return;
      }

      setIsSuccess(true);
      setTimeout(() => router.push('/purchases'), 2000);
    } catch (err: any) {
      const msg = err.message || 'Failed to save purchase invoice';
      if (msg.includes('DUPLICATE_INVOICE')) {
        toast.error(msg.replace('DUPLICATE_INVOICE: ', ''), { duration: 8000 });
      } else {
        setError(msg);
        toast.error(msg);
      }
    } finally {
      if (status === 'completed') setIsSaving(false);
      else setIsDrafting(false);
    }
  };

  useKeyboardShortcuts([
    { key: 'n', ctrl: true, shift: true, action: addItem, allowInInput: true },
    { key: 'Enter', ctrl: true, action: () => handleSave('completed'), allowInInput: true },
  ]);

  if (isLoading) {
    return (
      <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground font-medium">Loading invoice...</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-6 text-center">
        <CheckCircle2 size={80} className="text-emerald-500 animate-bounce" />
        <div className="grid gap-2">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Stock Added Manually!</h2>
          <p className="text-muted-foreground font-medium">Inventory updated successfully. Redirecting...</p>
        </div>
      </div>
    );
  }

  const totals = calculatePurchaseTotals(items);
  const isEditingCompleted = editStatus === 'completed';
  const pageTitle = isEditingCompleted
    ? 'Edit Manual Purchase'
    : editStatus === 'draft'
      ? 'Complete Manual Draft'
      : 'Manual Purchase Entry';

  return (
    <div className="container py-4 flex flex-col gap-4 pb-28">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link href="/purchases" />} className="rounded-full">
            <ArrowLeft size={24} />
          </Button>
          <h1 className="text-lg font-bold tracking-tight">{pageTitle}</h1>
        </div>
        {editStatus === 'draft' && (
          <Button
            variant="outline"
            disabled={isSaving || isDrafting || isDeleting}
            onClick={handleDeleteDraft}
            className="font-bold rounded-full text-rose-500 border-rose-200 bg-rose-50/20 hover:bg-rose-50 hover:text-rose-600"
          >
            {isDeleting ? 'Deleting...' : 'Delete Draft'}
          </Button>
        )}
      </header>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-xl border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSave('completed'); }} className="flex flex-col gap-4">
        <InvoiceHeaderCard
          data={{ ...invoiceData, total: totals.total }}
          onChange={(field, value) => setInvoiceData({ ...invoiceData, [field]: value })}
          invalidFields={invalidFields.header}
          distributors={distributors}
        />

        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold tracking-tight">Line Items ({items.length})</h2>
          <Button type="button" onClick={addItem} variant="outline" size="sm" className="rounded-full font-bold text-primary border-primary/20 bg-primary/5 hover:bg-primary/10">
            <Plus size={16} className="mr-2" /> Add Item
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <PurchaseItemCard
              key={idx}
              item={item}
              index={idx}
              onChange={handleItemChange}
              onRemove={removeItem}
              medicines={medicines}
              manufacturers={manufacturers}
              canRemove={items.length > 1}
              hasError={invalidFields.items.includes(idx)}
            />
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-xl border-t border-border z-50 shadow-lg">
          <div className="container max-w-4xl flex flex-col gap-3">
            <div className="flex flex-wrap gap-4 sm:gap-6 font-bold justify-center sm:justify-start text-sm">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Subtotal</span>
                ₹{totals.subtotal.toFixed(2)}
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex flex-col text-rose-500">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Discount</span>
                  -₹{totals.discountAmount.toFixed(2)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Tax</span>
                ₹{totals.gstAmount.toFixed(2)}
              </div>
              <div className="flex flex-col text-primary text-lg">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Net Total</span>
                ₹{totals.total.toFixed(2)}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {!isEditingCompleted && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-1/3 h-12 sm:h-11 text-sm font-bold rounded-xl shadow-md flex gap-2"
                  disabled={isSaving || isDrafting}
                  onClick={() => handleSave('draft')}
                >
                  {isDrafting ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                  {isDrafting ? 'Saving...' : 'Save as Draft'}
                </Button>
              )}
              <Button
                type="submit"
                className={`w-full h-12 sm:h-11 text-sm font-bold rounded-xl shadow-lg shadow-primary/15 flex gap-2 ${isEditingCompleted ? 'sm:w-full' : 'sm:w-2/3'}`}
                disabled={isSaving || isDrafting}
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                {isSaving
                  ? (isEditingCompleted ? 'Saving Changes...' : 'Saving Invoice...')
                  : isEditingCompleted
                    ? `Save Changes (${items.length} items)`
                    : `Save & Add to Inventory (${items.length} items)`}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function ManualPurchaseEntry() {
  return (
    <Suspense fallback={
      <div className="container min-h-[80vh] flex flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ManualPurchaseEntryContent />
    </Suspense>
  );
}
