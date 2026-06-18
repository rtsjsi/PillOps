'use client';

import { useEffect, useState } from 'react';
import { fetchPurchases } from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileScan, Box, History } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import TableLoading from '@/components/ui/tableLoading';

export default function Purchases() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'completed' | 'drafts'>('completed');

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

  const completedPurchases = purchases.filter(p => p.status === 'completed');
  const draftPurchases = purchases.filter(p => p.status === 'draft');
  const currentPurchases = activeTab === 'completed' ? completedPurchases : draftPurchases;

  return (
    <div className="container py-8 flex flex-col gap-8 pb-24">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
      </header>

      {/* Hero Action */}
      <Card className="flex flex-col items-center gap-6 p-8 bg-gradient-to-br from-primary/10 to-transparent border-primary/20 shadow-xl shadow-primary/5">
         <div className="bg-primary text-white p-5 rounded-3xl shadow-lg shadow-primary/30 ring-8 ring-primary/5 animate-pulse">
            <FileScan size={36} />
         </div>
         <div className="text-center max-w-sm">
            <h2 className="text-2xl font-extrabold mb-1 tracking-tight">AI Invoice Scanner</h2>
            <p className="text-muted-foreground text-sm font-medium mb-6 leading-relaxed">Instantly digitize distributor bills and update your inventory automatically.</p>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button render={<Link href="/purchases/scan" />} size="lg" className="flex-1 h-12 text-md font-bold rounded-xl shadow-lg shadow-primary/20">
                Scan Invoice
              </Button>
              <Button variant="outline" render={<Link href="/purchases/manual" />} size="lg" className="flex-1 h-12 text-md font-bold rounded-xl border-primary/20 hover:bg-primary/5">
                Manual Entry
              </Button>
            </div>
         </div>
      </Card>

      <section>
         <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-2">
             <History size={20} className="text-muted-foreground" />
             <h2 className="text-xl font-bold tracking-tight">Recent Inwards</h2>
           </div>
           <div className="flex bg-muted/30 p-1 rounded-xl">
             <Button
               variant={activeTab === 'completed' ? 'secondary' : 'ghost'}
               size="sm"
               className={cn("rounded-lg font-bold transition-all", activeTab === 'completed' && "bg-white shadow-sm")}
               onClick={() => setActiveTab('completed')}
             >
               Completed
             </Button>
             <Button
               variant={activeTab === 'drafts' ? 'secondary' : 'ghost'}
               size="sm"
               className={cn("rounded-lg font-bold transition-all", activeTab === 'drafts' && "bg-white shadow-sm")}
               onClick={() => setActiveTab('drafts')}
             >
               Drafts ({draftPurchases.length})
             </Button>
           </div>
         </div>
         <div className="flex flex-col gap-4">
            {currentPurchases.length === 0 ? (
               <Card className="flex flex-col items-center justify-center gap-4 p-12 text-muted-foreground bg-muted/10 border-dashed border-2">
                  <Box size={48} className="opacity-20" />
                  <p className="font-medium text-sm">No {activeTab} records yet.</p>
               </Card>
            ) : (
               currentPurchases.map((inv: any) => (
                  <Card key={inv.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                         <div className="font-bold text-lg leading-tight">{inv.distributorName || 'Draft'}</div>
                         <div className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatCurrency(inv.total)}</div>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2 border-t border-border/50">
                         <div className="bg-muted px-2 py-0.5 rounded">{inv.invoiceNumber ? `# ${inv.invoiceNumber}` : 'No Invoice #'}</div>
                         <div>{inv.invoiceDate ? formatDate(inv.invoiceDate) : 'No Date'}</div>
                      </div>
                      
                      {activeTab === 'drafts' && (
                        <div className="mt-2 flex justify-end">
                          <Button render={<Link href={`/purchases/review?draftId=${inv.id}`} />} size="sm" className="rounded-full">
                            Complete Draft
                          </Button>
                        </div>
                      )}
                      
                      {inv.items && inv.items.length > 0 && (
                        <details className="mt-2 group cursor-pointer border-t border-border/50 pt-2 text-sm">
                           <summary className="font-bold text-primary flex items-center gap-1 select-none">
                              View Items ({inv.items.length})
                           </summary>
                           <div className="mt-3 flex flex-col gap-2">
                             {inv.items.map((item: any) => (
                               <div key={item.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800">{item.medicine_name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">Batch: {item.batch_number} • Qty: {item.quantity}</span>
                                  </div>
                                  <div className="font-bold text-slate-900">
                                    ₹{item.total_amount}
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
