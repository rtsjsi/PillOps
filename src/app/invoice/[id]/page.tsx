import { getInvoiceById, getStoreSettings } from '@/app/actions';
import { formatCurrency } from '@/lib/utils';
import { Printer, ArrowLeft, Pill, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
        <div className="container min-h-screen flex flex-col items-center justify-center gap-6">
            <p className="text-muted-foreground font-medium">Invoice not found.</p>
            <Button asChild variant="outline">
              <Link href="/pos">Back to POS</Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="container py-10 max-w-4xl mx-auto flex flex-col gap-8 pb-32">
      
      {/* Action Bar - Hidden during print */}
      <div className="flex justify-between items-center bg-card border border-border p-4 rounded-2xl shadow-sm no-print">
          <Button asChild variant="ghost" className="font-bold">
            <Link href="/pos">
              <ArrowLeft size={16} className="mr-2" /> Back to POS
            </Link>
          </Button>
          <Button 
            className="font-bold shadow-lg shadow-primary/20"
            // Simple approach for server component print
            // In a real app we'd use a client component for the button
          >
            <Printer size={16} className="mr-2" /> Print Invoice
          </Button>
      </div>

      {/* Actual Invoice Body */}
      <Card className="border-none shadow-2xl bg-white text-black overflow-hidden print:shadow-none print:border print:m-0">
        <CardContent className="p-10 print:p-0">
          {/* Header */}
          <header className="flex justify-between items-start mb-12">
              <div>
                  <div className="flex items-center gap-3 mb-4">
                      <div className="bg-primary p-2 rounded-xl text-white shadow-lg shadow-primary/20">
                          <Pill size={24} />
                      </div>
                      <h1 className="text-2xl font-black tracking-tighter text-slate-900">{storeInfo?.name}</h1>
                  </div>
                  <div className="text-xs font-bold text-slate-500 max-w-[280px] leading-relaxed uppercase tracking-wider">
                      {storeInfo?.address}<br />
                      Ph: {storeInfo?.phone}<br />
                      GSTIN: {storeInfo?.gstin}
                  </div>
              </div>
              <div className="text-right">
                  <h2 className="text-5xl font-black text-slate-100 mb-2 tracking-tighter print:text-slate-200">INVOICE</h2>
                  <div className="font-bold text-slate-900"># {invoice.invoiceNumber}</div>
                  <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    {new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
              </div>
          </header>

          {/* Customer Details */}
          <div className="grid grid-cols-2 gap-8 mb-12 p-8 bg-slate-50 rounded-3xl print:bg-slate-50">
              <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Billed To</p>
                  <p className="font-black text-xl text-slate-900">{invoice.customerName}</p>
                  <p className="text-sm font-bold text-slate-500 mt-1">{invoice.customerPhone}</p>
              </div>
              <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Status</p>
                  <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-500/20">
                    <CheckCircle2 size={14} />
                    Paid in Full
                  </div>
              </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 mb-12">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-900 text-white uppercase tracking-widest text-[10px] font-black">
                        <th className="p-4">Item Description</th>
                        <th className="p-4 text-center">Batch</th>
                        <th className="p-4 text-center">Expiry</th>
                        <th className="p-4 text-right">Qty</th>
                        <th className="p-4 text-right">MRP</th>
                        <th className="p-4 text-right">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item: any, idx: number) => (
                        <tr key={idx} className="text-sm font-bold text-slate-700">
                            <td className="p-4">{item.medicineId}</td>
                            <td className="p-4 text-center text-slate-500 font-mono text-xs">{item.batchId}</td>
                            <td className="p-4 text-center text-slate-500 text-xs">{item.expiryDate}</td>
                            <td className="p-4 text-right">{item.quantity}</td>
                            <td className="p-4 text-right text-slate-500">₹{item.mrp.toFixed(2)}</td>
                            <td className="p-4 text-right text-slate-900 font-black">₹{(item.quantity * item.mrp).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
              <div className="w-full max-w-[320px] flex flex-col gap-3">
                  <div className="flex justify-between text-sm font-bold text-slate-500">
                      <span>Subtotal</span>
                      <span>{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.gstAmount !== null && (
                    <div className="flex justify-between text-sm font-bold text-slate-400 italic">
                        <span>GST (Included)</span>
                        <span>{formatCurrency(invoice.gstAmount)}</span>
                    </div>
                  )}
                  {invoice.discountAmount !== null && invoice.discountAmount > 0 && (
                      <div className="flex justify-between text-sm font-black text-emerald-600">
                          <span>Discount ({invoice.discountPercent}%)</span>
                          <span>-{formatCurrency(invoice.discountAmount)}</span>
                      </div>
                  )}
                  <div className="flex justify-between items-center pt-4 mt-2 border-t-2 border-slate-900">
                      <span className="text-lg font-black text-slate-900 tracking-tighter">NET TOTAL</span>
                      <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(invoice.total)}</span>
                  </div>
              </div>
          </div>

          {/* Footer info */}
          <div className="mt-20 pt-10 border-t-4 border-slate-900 flex justify-between gap-10">
              <div className="max-w-[400px] text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                  <p className="text-slate-900 mb-2 font-black">Terms & Conditions:</p>
                  1. Medicines once sold will not be taken back or exchanged.<br />
                  2. Please consult your physician before using any scheduled drug.<br />
                  3. Keep all medicines out of reach of children.
              </div>
              <div className="text-right flex flex-col justify-end">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">For {storeInfo?.name || 'Authorized Pharmacy'}</p>
                  <div className="h-20"></div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-t border-slate-200 pt-2">Authorized Signatory</p>
              </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Simple Client Print Script */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelectorAll('button').forEach(btn => {
          if (btn.innerText.includes('Print')) {
            btn.addEventListener('click', () => window.print());
          }
        });
      `}} />
    </div>
  );
}
