'use client';

import { useEffect, useState } from 'react';
import { fetchInventoryReport } from '@/lib/queries';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useDebounce } from '@/hooks/use-debounce';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Package, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportButtons } from '@/components/ui/export-buttons';

const PAGE_SIZE = 100;

export default function InventoryReport() {
  const { profile, loading: profileLoading } = useUserProfile();
  const storeId = profile?.store_id;
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  useEffect(() => {
    if (profileLoading || !storeId) {
      if (!profileLoading && !storeId) setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchInventoryReport(storeId, {
      search: debouncedSearch,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setTotalValue(data.totalValue);
      })
      .catch((error) => console.error('Failed to fetch inventory:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [storeId, profileLoading, debouncedSearch, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportData = items.map((med) => ({
    name: med.name,
    category: med.category,
    stock: med.totalStock,
    value: med.stockValue,
  }));

  const exportColumns = [
    { header: 'Medicine', key: 'name' },
    { header: 'Category', key: 'category' },
    { header: 'Stock Qty', key: 'stock', format: 'number' as const },
    { header: 'Est. Value', key: 'value', format: 'currency' as const },
  ];

  if (!profileLoading && !storeId) {
    return (
      <div className="container py-8 text-center text-muted-foreground">
        Please select a pharmacy to view the inventory report.
      </div>
    );
  }

  return (
    <div className="container py-8 flex flex-col gap-8 pb-24">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div className="text-right bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">
          <div className="text-xs font-bold text-primary uppercase tracking-widest">Total Stock Value</div>
          {loading ? (
            <Skeleton className="h-8 w-36 mt-1" />
          ) : (
            <div className="text-2xl font-extrabold text-primary">{formatCurrency(totalValue)}</div>
          )}
        </div>
      </header>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white dark:bg-slate-900 border-border/50"
            placeholder="Search medicines…"
          />
        </div>
        <ExportButtons data={exportData} columns={exportColumns} filename="inventory_report" title="Inventory Report" />
      </div>

      <section>
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
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
                  {items.map((med) => (
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
                          {med.batches?.length > 0 ? med.batches.map((b: any) => (
                            <div key={b.id} className="text-[10px] font-medium text-muted-foreground">
                              {b.batchNumber} (Qty: {b.quantity})
                            </div>
                          )) : <span className="text-[10px] text-muted-foreground">No Batches</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                        {formatCurrency(med.stockValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} ({total} medicines)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={16} className="mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1 || loading} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
