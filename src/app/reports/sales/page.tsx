'use client';

import { useEffect, useState } from 'react';
import { fetchInvoices } from '@/lib/queries';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Receipt, Printer } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import TableLoading from '@/components/ui/tableLoading';

export default function SalesRegister() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvoices() {
      try {
        const data = await fetchInvoices();
        setInvoices(data);
      } catch (error) {
        console.error('Failed to fetch sales history:', error);
      } finally {
        setLoading(false);
      }
    }
    loadInvoices();
  }, []);

  if (loading) return <TableLoading />;

  return (
    <div className="container py-8 flex flex-col gap-8 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Register</h1>
          <p className="text-muted-foreground font-medium mt-1">View all your historical sales invoices.</p>
        </div>
      </header>

      <section>
         <div className="flex flex-col gap-4">
            {invoices.length === 0 ? (
               <Card className="flex flex-col items-center justify-center gap-4 p-12 text-muted-foreground bg-muted/10 border-dashed border-2">
                  <Receipt size={48} className="opacity-20" />
                  <p className="font-medium text-sm">No sales records found.</p>
               </Card>
            ) : (
               invoices.map((inv: any) => (
                  <Card key={inv.id} className="hover:shadow-md transition-shadow border-border/50">
                    <CardContent className="p-5 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                         <div>
                           <div className="font-bold text-lg leading-tight text-slate-800 dark:text-slate-200">
                             {inv.customerName || 'Walk-in Customer'}
                           </div>
                           <div className="text-xs text-muted-foreground mt-0.5 uppercase tracking-widest font-bold">
                             {inv.customerPhone ? `Mob: ${inv.customerPhone}` : 'No Phone'}
                           </div>
                         </div>
                         <div className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xl">
                           {formatCurrency(inv.total)}
                         </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-widest pt-3 border-t border-border/50">
                         <div className="flex items-center gap-4">
                           <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md">
                             # {inv.invoiceNumber}
                           </div>
                           <div>{formatDate(inv.created_at)}</div>
                         </div>
                         <Button render={<Link href={`/invoice/${inv.id}`} />} variant="outline" size="sm" className="h-8 font-bold text-xs bg-muted/50 border-border/50">
                             <Printer size={14} className="mr-2" /> View Bill
                         </Button>
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
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.medicine?.global_medicine_master?.name || 'Medicine'}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">
                                      Batch: {item.batch?.batch_number || 'N/A'} • Qty: {item.quantity}
                                    </span>
                                  </div>
                                  <div className="font-bold text-slate-900 dark:text-slate-100">
                                    {formatCurrency(item.mrp * item.quantity)}
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
