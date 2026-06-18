'use client';

import { useEffect, useState } from 'react';
import { fetchPurchases } from '@/lib/queries';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowDownToLine, FileScan, Box } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import TableLoading from '@/components/ui/tableLoading';
import { ExportButtons } from '@/components/ui/export-buttons';

export default function PurchaseRegister() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPurchases() {
      try {
        const data = await fetchPurchases();
        setPurchases(data);
      } catch (error) {
        console.error('Failed to fetch purchases:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPurchases();
  }, []);

  if (loading) return <TableLoading />;

  const exportData = purchases.map(inv => ({
    date: inv.invoiceDate,
    invoiceNo: inv.invoiceNumber,
    distributor: inv.distributorName,
    subtotal: inv.subtotal,
    gst: inv.gstAmount,
    total: inv.total
  }));

  const exportColumns = [
    { header: 'Date', key: 'date', format: 'date' as const },
    { header: 'Invoice No', key: 'invoiceNo' },
    { header: 'Distributor', key: 'distributor' },
    { header: 'Subtotal', key: 'subtotal', format: 'currency' as const },
    { header: 'GST', key: 'gst', format: 'currency' as const },
    { header: 'Total', key: 'total', format: 'currency' as const },
  ];

  return (
    <div className="container py-8 flex flex-col gap-8 pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <ExportButtons data={exportData} columns={exportColumns} filename="purchase_register" title="Purchase Register" />
      </header>

      <section>
         <div className="flex flex-col gap-4">
            {purchases.length === 0 ? (
               <Card className="flex flex-col items-center justify-center gap-4 p-12 text-muted-foreground bg-muted/10 border-dashed border-2">
                  <Box size={48} className="opacity-20" />
                  <p className="font-medium text-sm">No purchase records found.</p>
               </Card>
            ) : (
               purchases.map((inv: any) => (
                  <Card key={inv.id} className="hover:shadow-md transition-shadow border-border/50">
                    <CardContent className="p-5 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                         <div className="font-bold text-lg leading-tight text-slate-800 dark:text-slate-200">
                           {inv.distributorName}
                         </div>
                         <div className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xl">
                           {formatCurrency(inv.total)}
                         </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-widest pt-3 border-t border-border/50">
                         <div className="flex items-center gap-4">
                           <div className="bg-muted px-2.5 py-1 rounded-md">
                             # {inv.invoiceNumber}
                           </div>
                           <div>{formatDate(inv.invoiceDate)}</div>
                         </div>
                      </div>

                      {inv.items && inv.items.length > 0 && (
                        <details className="mt-2 group cursor-pointer border-t border-border/50 pt-3 text-sm">
                           <summary className="font-bold text-primary flex items-center gap-1 select-none">
                               View Items ({inv.items.length})
                           </summary>
                           <div className="mt-3 flex flex-col gap-2">
                             {inv.items.map((item: any) => (
                               <div key={item.id} className="flex justify-between items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.medicineName}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">
                                      Batch: {item.batchNumber} • Qty: {item.quantity}
                                    </span>
                                  </div>
                                  <div className="font-bold text-slate-900 dark:text-slate-100">
                                    {formatCurrency(item.totalAmount)}
                                  </div>
                               </div>
                             ))}
                           </div>
                        </details>
                      )}
                    </CardContent>
                  </Card>
               ))
            )}
         </div>
      </section>
    </div>
  );
}
