'use client';

import { useEffect, useState } from 'react';
import { fetchPurchasesList } from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { FileScan, Box, History, Pencil } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import TableLoading from '@/components/ui/tableLoading';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function Purchases() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'completed' | 'drafts'>('completed');

  const handleDeleteDraft = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this draft invoice?")) return;
    
    try {
      const supabase = createClient();
      const { error } = await supabase.from('purchase_invoices').delete().eq('id', id);
      
      if (error) throw error;
      
      toast.success("Draft invoice deleted successfully.");
      setPurchases(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      console.error("Failed to delete draft:", err);
      toast.error(err.message || "Failed to delete draft invoice.");
    }
  };

  useEffect(() => {
    async function loadPurchases() {
      try {
        const data = await fetchPurchasesList();
        setPurchases(data);
      } catch (error) {
        console.error('Failed to fetch purchases:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPurchases();
  }, []);

  if (loading) {
    return (
      <div className="container py-4 flex flex-col gap-5 pb-24">
        <div className="flex gap-3">
          <Button size="lg" className="flex-1 h-11" disabled>Scan Invoice</Button>
          <Button variant="outline" size="lg" className="flex-1 h-11" disabled>Manual Entry</Button>
        </div>
        <TableLoading />
      </div>
    );
  }

  const completedPurchases = purchases.filter(p => p.status === 'completed');
  const draftPurchases = purchases.filter(p => p.status === 'draft');
  const currentPurchases = activeTab === 'completed' ? completedPurchases : draftPurchases;

  return (
    <div className="container py-4 flex flex-col gap-5 pb-24">


      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button render={<Link href="/purchases/scan" />} size="lg" className="flex-1 h-11 text-sm font-bold rounded-lg shadow-sm">
          Scan Invoice
        </Button>
        <Button variant="outline" render={<Link href="/purchases/manual" />} size="lg" className="flex-1 h-11 text-sm font-bold rounded-lg">
          Manual Entry
        </Button>
      </div>

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
                    <CardContent className="p-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-start">
                         <div className="font-bold text-base leading-tight">{inv.distributorName || 'Draft'}</div>
                         <div className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatCurrency(inv.total)}</div>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2 border-t border-border/50">
                         <div className="bg-muted px-2 py-0.5 rounded">{inv.invoiceNumber ? `# ${inv.invoiceNumber}` : 'No Invoice #'}</div>
                         <div>{inv.invoiceDate ? formatDate(inv.invoiceDate) : 'No Date'}</div>
                      </div>
                      
                      {activeTab === 'completed' && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            render={<Link href={`/purchases/review?invoiceId=${inv.id}`} />}
                            variant="outline"
                            size="sm"
                            className="rounded-full font-bold"
                          >
                            <Pencil size={14} className="mr-1.5" />
                            Edit Invoice
                          </Button>
                        </div>
                      )}

                      {activeTab === 'drafts' && (
                        <div className="mt-2 flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full text-rose-500 border-rose-200 bg-rose-50/50 hover:bg-rose-50 hover:text-rose-600 font-bold"
                            onClick={() => handleDeleteDraft(inv.id)}
                          >
                            Delete Draft
                          </Button>
                          <Button
                            render={
                              <Link
                                href={
                                  inv.items?.some((item: any) => item.extractedName || item.extracted_name)
                                    ? `/purchases/review?invoiceId=${inv.id}`
                                    : `/purchases/manual?invoiceId=${inv.id}`
                                }
                              />
                            }
                            size="sm"
                            className="rounded-full"
                          >
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
