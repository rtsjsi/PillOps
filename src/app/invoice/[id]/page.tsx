import { getInvoiceById, getStoreSettings } from '@/app/actions';
import { formatCurrency } from '@/lib/utils';
import { Printer, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoicePage({ params }: PageProps) {
  const { id } = await params;
  
  const [invoice, storeInfo] = await Promise.all([
    getInvoiceById(id),
    getStoreSettings()
  ]);

  if (!invoice) {
    return (
        <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', gap: '16px' }}>
            <div className="text-muted">Invoice not found.</div>
            <Link href="/pos" className="btn btn-outline">Back to POS</Link>
        </div>
    );
  }

  return (
    <div className="invoice-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', background: '#fff', color: '#000', minHeight: '100vh' }}>
      
      {/* Action Bar - Hidden during print */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', padding: '12px', background: 'var(--color-bg-card)', borderRadius: '12px', border: '1px solid rgba(107,114,128,0.1)' }}>
          <Link href="/pos" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={16} /> Back to POS
          </Link>
          <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                // We'll use a small client script for printing
                onClick={undefined} 
              >
                  <Printer size={16} /> Print Invoice
              </button>
          </div>
      </div>

      {/* Actual Invoice Body */}
      <div id="printable-invoice" style={{ padding: '40px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ width: '32px', height: '32px', background: 'var(--color-primary)', borderRadius: '8px' }}></div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>{storeInfo?.storeName}</h1>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#4b5563', maxWidth: '280px', lineHeight: '1.5' }}>
                    {storeInfo?.storeAddress}<br />
                    Ph: {storeInfo?.storePhone}<br />
                    GSTIN: {storeInfo?.gstin}
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: '900', color: '#e5e7eb', marginBottom: '4px', letterSpacing: '0.05em' }}>TAX INVOICE</h2>
                <div style={{ fontWeight: 'bold', color: '#111827' }}>Invoice #: {invoice.invoiceNumber}</div>
                <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Date: {new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
        </header>

        {/* Customer Details */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
            <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '4px' }}>Billed To</div>
                <div style={{ fontWeight: 'bold', color: '#111827', fontSize: '1.1rem' }}>{invoice.customerName}</div>
                <div style={{ color: '#4b5563', fontSize: '0.9rem' }}>{invoice.customerPhone}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '4px' }}>Payment Mode</div>
                <div style={{ fontWeight: 'bold', color: '#111827' }}>Cash / Pharmacy Credit</div>
            </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
            <thead>
                <tr style={{ background: '#111827', color: '#fff' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600' }}>ITEM DESCRIPTION</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600' }}>BATCH</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '600' }}>EXP</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600' }}>QTY</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600' }}>MRP</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600' }}>GST</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600' }}>AMOUNT</th>
                </tr>
            </thead>
            <tbody>
                {invoice.items.map((item: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 8px', fontSize: '0.9rem', color: '#1f2937', fontWeight: '500' }}>{item.medicineId}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.85rem', color: '#4b5563' }}>{item.batchId}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.85rem', color: '#4b5563' }}>{item.expiryDate}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.85rem', color: '#4b5563' }}>{item.quantity}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.85rem', color: '#4b5563' }}>₹{item.mrp.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.85rem', color: '#4b5563' }}>{item.gstPercent}%</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold', color: '#111827' }}>₹{(item.quantity * item.mrp).toFixed(2)}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '100%', maxWidth: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Gross Subtotal</span>
                    <span style={{ fontWeight: '500' }}>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Estimated GST (Included)</span>
                    <span style={{ fontWeight: '500' }}>{formatCurrency(invoice.gstAmount)}</span>
                </div>
                {invoice.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', color: '#10b981' }}>
                        <span style={{ fontSize: '0.9rem' }}>Discount ({invoice.discountPercent}%)</span>
                        <span style={{ fontWeight: '500' }}>-{formatCurrency(invoice.discountAmount)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', marginTop: '4px' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#111827' }}>NET TOTAL</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--color-primary)' }}>{formatCurrency(invoice.total)}</span>
                </div>
            </div>
        </div>

        {/* Footer info */}
        <div style={{ marginTop: '60px', paddingTop: '20px', borderTop: '2px solid #111827', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280' }}>
            <div style={{ maxWidth: '400px' }}>
                <strong>Terms & Conditions:</strong><br />
                1. Medicines once sold will not be taken back or exchanged.<br />
                2. Please consult your physician before using any scheduled drug.<br />
                3. Keep all medicines out of reach of children.
            </div>
            <div style={{ textAlign: 'right' }}>
                For <strong>{storeInfo?.storeName}</strong><br /><br /><br /><br />
                Authorized Signatory
            </div>
        </div>
      </div>
      
      {/* Simple Client Print Script */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelector('.btn-primary').addEventListener('click', () => window.print());
      `}} />
    </div>
  );
}
