'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { savePurchaseInvoice } from '@/app/actions';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle2, ArrowLeft, Sparkles, Edit2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

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
        <div className="flex-center" style={{ height: 'calc(100vh - 56px)', flexDirection: 'column', gap: '16px', padding: '20px', textAlign: 'center' }}>
           <AlertTriangle size={64} color="var(--color-danger)" />
           <h2 style={{ fontSize: '1.5rem' }}>Error</h2>
           <p className="text-muted">{error}</p>
           <Link href="/purchases/scan" className="btn btn-primary" style={{ marginTop: '16px' }}>Try Again</Link>
        </div>
     );
  }

  if (!data) {
     return <div className="flex-center" style={{ height: '100vh' }}>Loading extracted data...</div>;
  }

  if (isSuccess) {
      return (
          <div className="flex-center" style={{ height: 'calc(100vh - 56px)', flexDirection: 'column', gap: '16px' }}>
              <div style={{ color: 'var(--color-success)' }}><CheckCircle2 size={64} /></div>
              <h2 style={{ fontSize: '1.5rem' }}>Stock Added!</h2>
              <p className="text-muted">Inventory updated successfully.</p>
          </div>
      );
  }

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '90px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/purchases/scan" className="btn btn-outline" style={{ padding: '8px', border: 'none' }}>
           <ArrowLeft size={24} />
        </Link>
        <h1 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
           Review Data
           <Sparkles size={20} color="var(--color-primary)" />
        </h1>
      </header>

      <Card>
         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
               <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Distributor</div>
               <div style={{ fontWeight: 'bold' }}>{data.distributorName}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Date</div>
               <div style={{ fontWeight: 'bold' }}>{data.invoiceDate}</div>
            </div>
         </div>
         <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(107,114,128,0.1)', paddingTop: '16px' }}>
            <div>
               <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Invoice No</div>
               <div style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{data.invoiceNumber}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Net Amount</div>
               <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--color-success)' }}>{formatCurrency(data.total)}</div>
            </div>
         </div>
      </Card>

      <div>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
             <h2 style={{ fontSize: '1.1rem' }}>Extracted Items ({data.items.length})</h2>
             <button 
                onClick={() => setIsEditing(!isEditing)}
                style={{ color: isEditing ? 'var(--color-success)' : 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', padding: '4px 8px', borderRadius: '4px', background: isEditing ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}
             >
                 {isEditing ? <CheckCircle2 size={14} /> : <Edit2 size={14} />} 
                 {isEditing ? 'Done' : 'Edit'}
             </button>
         </div>
         
         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.items.map((item: any, idx: number) => (
               <Card key={idx} noPadding style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                     <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                         <span style={{ background: 'var(--color-primary-glow)', color: 'var(--color-primary)', borderRadius: '100px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold flex-shrink-0' }}>{idx + 1}</span>
                         {isEditing ? (
                             <input className="input" value={item.medicineName} onChange={e => handleItemChange(idx, 'medicineName', e.target.value)} style={{ padding: '4px', fontSize: '0.9rem', height: '30px', width: '100%' }} />
                         ) : item.medicineName}
                     </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                     {isEditing ? (
                        <>
                          <div><span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Batch</span><input className="input" value={item.batchNumber} onChange={e=>handleItemChange(idx, 'batchNumber', e.target.value)} style={{ padding:'2px 4px', height:'24px', width: '100%' }}/></div>
                          <div><span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Exp (YYYY-MM)</span><input className="input" value={item.expiryDate} onChange={e=>handleItemChange(idx, 'expiryDate', e.target.value)} style={{ padding:'2px 4px', height:'24px', width: '100%' }}/></div>
                          <div><span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Rate</span><input type="number" className="input" value={item.purchasePrice} onChange={e=>handleItemChange(idx, 'purchasePrice', parseFloat(e.target.value))} style={{ padding:'2px 4px', height:'24px', width: '100%' }}/></div>
                          <div><span className="text-muted block text-xs" style={{ display: 'block', fontSize: '0.75rem' }}>MRP</span><input type="number" className="input" value={item.mrp} onChange={e=>handleItemChange(idx, 'mrp', parseFloat(e.target.value))} style={{ padding:'2px 4px', height:'24px', width: '100%' }}/></div>
                          <div><span className="text-muted block text-xs" style={{ display: 'block', fontSize: '0.75rem' }}>Disc %</span><input type="number" className="input" value={item.discountPercent} onChange={e=>handleItemChange(idx, 'discountPercent', parseFloat(e.target.value))} style={{ padding:'2px 4px', height:'24px', width: '100%' }}/></div>
                          <div><span className="text-muted block text-xs" style={{ display: 'block', fontSize: '0.75rem' }}>Qty</span><input type="number" className="input" value={item.quantity} onChange={e=>handleItemChange(idx, 'quantity', parseInt(e.target.value))} style={{ padding:'2px 4px', height:'24px', width: '100%' }}/></div>
                          <div><span className="text-muted block text-xs" style={{ display: 'block', fontSize: '0.75rem' }}>Free Qty</span><input type="number" className="input" value={item.freeQuantity} onChange={e=>handleItemChange(idx, 'freeQuantity', parseInt(e.target.value))} style={{ padding:'2px 4px', height:'24px', width: '100%' }}/></div>
                          <div><span className="text-muted block text-xs" style={{ display: 'block', fontSize: '0.75rem' }}>Mfr</span><input className="input" value={item.manufacturer || ''} onChange={e=>handleItemChange(idx, 'manufacturer', e.target.value)} style={{ padding:'2px 4px', height:'24px', width: '100%' }}/></div>
                          <div><span className="text-muted block text-xs" style={{ display: 'block', fontSize: '0.75rem' }}>HSN</span><input className="input" value={item.hsnCode || ''} onChange={e=>handleItemChange(idx, 'hsnCode', e.target.value)} style={{ padding:'2px 4px', height:'24px', width: '100%' }}/></div>
                        </>
                     ) : (
                        <>
                          <div><span className="text-muted">Batch:</span> {item.batchNumber}</div>
                          <div><span className="text-muted">Exp:</span> {item.expiryDate}</div>
                          <div><span className="text-muted">Rate:</span> ₹{item.purchasePrice}</div>
                          <div><span className="text-muted">Disc:</span> {item.discountPercent}%</div>
                          <div><span className="text-muted">MRP:</span> ₹{item.mrp}</div>
                          <div style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                              <span className="text-muted mr-1">Qty:</span>
                              {item.quantity} {item.freeQuantity > 0 && <span style={{ color: 'var(--color-success)' }}>+{item.freeQuantity} Free</span>}
                          </div>
                          <div><span className="text-muted">Tax:</span> {item.gstPercent}%</div>
                          {(item.manufacturer || item.hsnCode) && (
                              <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed rgba(107,114,128,0.2)', paddingTop: '4px', marginTop: '4px' }}>
                                 <span className="text-muted">Mfr:</span> {item.manufacturer || 'N/A'} • <span className="text-muted">HSN:</span> {item.hsnCode || 'N/A'}
                              </div>
                          )}
                        </>
                     )}
                  </div>
               </Card>
            ))}
         </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px', background: 'var(--color-bg-card)', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)', zIndex: 100 }}>
         <button 
            className="btn btn-primary" 
            disabled={isSaving}
            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
            onClick={handleConfirm}
         >
            {isSaving ? 'Saving to Database...' : 'Confirm & Add to Inventory'}
         </button>
      </div>
    </div>
  );
}
