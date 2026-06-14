'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchInvoiceById, fetchStoreSettings } from '@/lib/queries';
import { formatExpiryDate, numberToWords } from '@/lib/utils';
import { Printer, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const [inv, store] = await Promise.all([
          fetchInvoiceById(id),
          fetchStoreSettings(),
        ]);
        setInvoice(inv);
        setStoreInfo(store);
      } catch (err) {
        console.error('Failed to load invoice:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="container min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return (
        <div className="container min-h-screen flex flex-col items-center justify-center gap-6">
            <p className="text-muted-foreground font-medium">Invoice not found.</p>
            <Button render={<Link href="/pos" />} variant="outline">
              Back to POS
            </Button>
        </div>
    );
  }

  const invoiceDate = new Date(invoice.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const totalQty = invoice.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const netAmount = Math.round(invoice.total);
  const roundOff = (netAmount - invoice.total).toFixed(2);
  const words = numberToWords(netAmount);

  return (
    <div className="min-h-screen bg-slate-100 py-10 print:bg-white print:py-0">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 0.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .no-print { display: none !important; }
          .print-border { border-color: black !important; }
          .print-text { color: black !important; }
        }
        .retail-table th, .retail-table td {
          border-right: 1px solid black;
          padding: 2px 4px;
        }
        .retail-table th:last-child, .retail-table td:last-child {
          border-right: none;
        }
      `}} />

      {/* Action Bar - Hidden during print */}
      <div className="max-w-[900px] mx-auto mb-6 flex justify-between items-center bg-white border border-slate-200 p-4 rounded-xl shadow-sm no-print">
          <Button render={<Link href="/pos" />} variant="ghost" className="font-bold">
              <ArrowLeft size={16} className="mr-2" /> Back to POS
          </Button>
          <Button 
            className="font-bold shadow-lg"
            onClick={() => window.print()}
          >
            <Printer size={16} className="mr-2" /> Print Invoice
          </Button>
      </div>

      {/* Actual Invoice Body */}
      <div className="max-w-[900px] mx-auto bg-white text-black font-sans text-[11px] leading-tight print:w-full print:max-w-none print:shadow-none print:m-0 border border-black print-border">
          
          {/* Header Row 1 */}
          <div className="flex border-b border-black print-border">
              <div className="flex-[2] p-2 border-r border-black print-border">
                  <h1 className="text-[16px] font-bold uppercase">{storeInfo?.name || 'MEDICAL STORE'}</h1>
                  <p className="uppercase mt-1">{storeInfo?.address || 'ADDRESS NOT PROVIDED'}</p>
              </div>
              <div className="flex-1 p-2 border-r border-black print-border flex flex-col justify-between">
                  <div className="uppercase">BILL OF SUPPLY</div>
                  <div className="flex justify-between mt-4">
                      <span>ORIGINAL</span>
                      <span>Page : 1 of 1</span>
                  </div>
              </div>
              <div className="flex-1 p-2 flex flex-col justify-between">
                  <div>MO. {storeInfo?.phone || 'N/A'}</div>
                  <div className="mt-1">D.L NO. {storeInfo?.drugLicense || ''}</div>
                  {storeInfo?.gstin && <div className="mt-1">GSTIN: {storeInfo?.gstin}</div>}
              </div>
          </div>

          {/* Header Row 2 - Customer Info */}
          <div className="flex border-b border-black print-border">
              <div className="flex-[2] p-2 border-r border-black print-border">
                  <div className="grid grid-cols-[60px_auto] gap-2">
                      <span>Customer</span>
                      <span className="uppercase">: {invoice.customerName}</span>
                      <span>Doctor</span>
                      <span className="uppercase">: WALK-IN</span>
                  </div>
              </div>
              <div className="flex-1 p-2 border-r border-black print-border">
                  <div className="grid grid-cols-[40px_auto] gap-2">
                      <span>Area</span>
                      <span className="uppercase">: LOCAL</span>
                      <span>Area</span>
                      <span>: </span>
                  </div>
              </div>
              <div className="flex-1 p-2">
                  <div className="grid grid-cols-[50px_auto] gap-2">
                      <span>Bill No</span>
                      <span className="font-bold">: {invoice.invoiceNumber} <span className="float-right ml-4">{invoiceDate}</span></span>
                      <span>Mobile</span>
                      <span>: {invoice.customerPhone}</span>
                  </div>
              </div>
          </div>

          {/* Table */}
          <div className="min-h-[300px]">
              <table className="w-full text-left retail-table border-b border-black print-border">
                  <thead>
                      <tr className="border-b border-black print-border bg-slate-50 print:bg-transparent">
                          <th className="w-[30px] text-center">Sr.</th>
                          <th>Description</th>
                          <th className="w-[40px]">Pack</th>
                          <th className="w-[60px]">HSN</th>
                          <th className="w-[80px]">BatchNo</th>
                          <th className="w-[50px]">ExpDt</th>
                          <th className="w-[40px] text-right">Qty</th>
                          <th className="w-[50px] text-right">MRP</th>
                          <th className="w-[60px] text-right">Revised<br/>MRP</th>
                          <th className="w-[40px] text-right">Disc</th>
                          <th className="w-[60px] text-right">Amount</th>
                      </tr>
                  </thead>
                  <tbody>
                      {invoice.items.map((item: any, idx: number) => {
                          const amount = item.quantity * item.mrp;
                          const expDt = item.expiryDate ? formatExpiryDate(item.expiryDate).split(' ').join('/') : '';
                          const hsn = item.medicine?.hsnCode || '30049099';
                          const pack = item.medicine?.pack || 'TAB';
                          const disc = invoice.discountPercent > 0 ? invoice.discountPercent.toFixed(2) : '0.00';
                          
                          // Revised MRP logic (simplified approximation based on discount)
                          const revisedMrp = item.mrp * (1 - (invoice.discountPercent / 100));

                          return (
                              <tr key={idx} className="align-top">
                                  <td className="text-center">{idx + 1}</td>
                                  <td className="uppercase">{item.medicine?.name || item.medicineName}</td>
                                  <td className="uppercase text-xs">{pack}</td>
                                  <td>{hsn}</td>
                                  <td className="uppercase">{item.batchNumber || item.batch?.batch_number}</td>
                                  <td>{expDt.substring(0, 5)}</td> {/* e.g. 06/27 */}
                                  <td className="text-right">{item.quantity}</td>
                                  <td className="text-right">{item.mrp.toFixed(2)}</td>
                                  <td className="text-right">{revisedMrp.toFixed(2)}</td>
                                  <td className="text-right">{disc}</td>
                                  <td className="text-right">{amount.toFixed(2)}</td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>

          {/* Footer Area */}
          <div className="flex border-b border-black print-border">
              <div className="flex-[3] p-2 border-r border-black print-border flex flex-col justify-end pb-1">
                  <div>PAN NO. {storeInfo?.panNo || ''}</div>
                  <div className="mt-4 uppercase">MSG-BROKEN & CUTTING STRIPS WILL BE NOT TAKEN BACK.</div>
                  <div className="mt-1">Rupees {words} Only</div>
              </div>
              <div className="flex-1">
                  <div className="flex justify-between border-b border-black print-border px-2 py-1">
                      <span className="font-bold">{totalQty}</span>
                      <span></span>
                      <span className="font-bold">{invoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-black print-border px-2 py-1">
                      <span>OTHER +/-</span>
                      <span>0.00</span>
                  </div>
                  <div className="flex justify-between border-b border-black print-border px-2 py-1">
                      <span>ROUND OFF</span>
                      <span>{roundOff}</span>
                  </div>
                  <div className="flex justify-between px-2 py-1 items-center bg-slate-50 print:bg-transparent">
                      <span className="text-lg font-bold">NET</span>
                      <span className="text-lg font-bold">{netAmount.toFixed(2)}</span>
                  </div>
              </div>
          </div>

          {/* Bottom Info */}
          <div className="flex justify-between px-2 py-1 text-[9px] text-slate-600 print:text-black">
              <div>(G2).Software by PILLOPS : Customer Care No: +91 XXXXXXXXXX</div>
              <div>USER: ADMIN</div>
              <div>E. & O. E.</div>
          </div>
      </div>
    </div>
  );
}
