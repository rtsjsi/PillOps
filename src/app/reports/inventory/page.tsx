'use client';

import { useEffect, useState } from 'react';
import { fetchMedicines } from '@/lib/queries';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Package, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TableLoading from '@/components/ui/tableLoading';

export default function InventoryReport() {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadMedicines() {
      try {
        const data = await fetchMedicines();
        setMedicines(data);
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setLoading(false);
      }
    }
    loadMedicines();
  }, []);

  const filtered = medicines.filter(m => 
    (m.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (m.genericName || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filtered.reduce((sum, med) => {
    const medValue = (med.batches || []).reduce((batchSum: number, b: any) => batchSum + (b.quantity * b.purchasePrice), 0);
    return sum + medValue;
  }, 0);

  if (loading) return <TableLoading />;

  return (
    <div className="container py-8 flex flex-col gap-8 pb-24">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">On Hand Stock</h1>
          <p className="text-muted-foreground font-medium mt-1">Live inventory snapshot and valuation.</p>
        </div>
        <div className="text-right bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">
           <div className="text-xs font-bold text-primary uppercase tracking-widest">Total Stock Value</div>
           <div className="text-2xl font-extrabold text-primary">{formatCurrency(totalValue)}</div>
        </div>
      </header>

      <div className="relative max-w-md">
         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
         <Input 
           placeholder="Search stock..." 
           value={search}
           onChange={(e) => setSearch(e.target.value)}
           className="pl-10 bg-white dark:bg-slate-900 border-border/50"
         />
      </div>

      <section>
         <div className="flex flex-col gap-3">
            {filtered.length === 0 ? (
               <Card className="flex flex-col items-center justify-center gap-4 p-12 text-muted-foreground bg-muted/10 border-dashed border-2">
                  <Package size={48} className="opacity-20" />
                  <p className="font-medium text-sm">No stock records found.</p>
               </Card>
            ) : (
               <div className="overflow-x-auto bg-white dark:bg-slate-950 rounded-xl border border-border/50 shadow-sm">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                       <tr>
                          <th className="px-4 py-3">Medicine</th>
                          <th className="px-4 py-3 text-right">Stock</th>
                          <th className="px-4 py-3">Batches</th>
                          <th className="px-4 py-3 text-right">Est. Value</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                       {filtered.map(med => {
                         const medValue = (med.batches || []).reduce((sum: number, b: any) => sum + (b.quantity * b.purchasePrice), 0);
                         return (
                           <tr key={med.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900 dark:text-slate-100">{med.name}</div>
                                <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{med.category}</div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold">
                                <span className={med.totalStock <= med.reorderLevel ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>
                                  {med.totalStock}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  {med.batches && med.batches.length > 0 ? med.batches.map((b: any) => (
                                     <div key={b.id} className="text-[10px] font-medium text-muted-foreground">
                                       {b.batchNumber} (Qty: {b.quantity})
                                     </div>
                                  )) : <span className="text-[10px] text-muted-foreground">No Batches</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                                {formatCurrency(medValue)}
                              </td>
                           </tr>
                         );
                       })}
                    </tbody>
                 </table>
               </div>
            )}
         </div>
      </section>
    </div>
  );
}
