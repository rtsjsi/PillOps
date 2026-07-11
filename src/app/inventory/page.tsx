'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchInventoryList } from '@/lib/queries';
import { useUserProfile } from '@/contexts/user-profile-context';
import { useDebounce } from '@/hooks/use-debounce';
import { SearchBar } from '@/components/ui/searchBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getStockStatus, cn, getDaysUntilExpiry, getExpiryStatus } from '@/lib/utils';
import { Plus, AlertTriangle, Download, Clock, XCircle, ShieldCheck, PackageSearch, FileScan, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FAB } from '@/components/ui/fab';
import { csvExport } from '@/lib/export';
import dynamic from 'next/dynamic';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const InventoryPDFButton = dynamic(
  () => import('@/components/inventory/pdf-button').then((mod) => mod.InventoryPDFButton),
  { ssr: false }
);

const PAGE_SIZE = 50;

function enrichBatches(batches: any[]) {
  return (batches || []).map((batch) => {
    const days = getDaysUntilExpiry(batch.expiryDate);
    return { ...batch, daysUntilExpiry: days, expiryStatus: getExpiryStatus(days) };
  });
}

export default function Inventory() {
  const { profile, loading: profileLoading } = useUserProfile();
  const storeId = profile?.store_id;
  const storeName = profile?.store?.name || 'My Pharmacy';

  const [medicines, setMedicines] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);



  useEffect(() => {
    if (profileLoading || !storeId) {
      if (!profileLoading && !storeId) setLoadingList(false);
      return;
    }

    let cancelled = false;
    setLoadingList(true);
    setErrorMsg(null);

    fetchInventoryList(storeId, {
      search: debouncedSearch,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
      .then(({ items, total: count }) => {
        if (cancelled) return;
        setMedicines(items.map((med) => ({
          ...med,
          batches: enrichBatches(med.batches),
        })));
        setTotal(count);
      })
      .catch((err: any) => {
        if (!cancelled) setErrorMsg(err.message || String(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });

    return () => { cancelled = true; };
  }, [storeId, profileLoading, debouncedSearch, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = useCallback(async () => {
    if (!storeId) return;
    setExporting(true);
    try {
      const { items } = await fetchInventoryList(storeId, {
        search: debouncedSearch,
        offset: 0,
        limit: 200,
      });
      csvExport(items.map((m) => ({
        name: m.name,
        generic: m.genericName,
        category: m.category,
        stock: m.totalStock,
        status: m.overallExpiryStatus,
      })), 'inventory_report');
    } finally {
      setExporting(false);
    }
  }, [storeId, debouncedSearch]);

  const [exportPdfData, setExportPdfData] = useState<any[]>([]);
  const preparePdfExport = useCallback(async () => {
    if (!storeId || exportPdfData.length > 0) return;
    const { items } = await fetchInventoryList(storeId, {
      search: debouncedSearch,
      offset: 0,
      limit: 200,
    });
    setExportPdfData(items.map((m) => ({ ...m, totalQty: m.totalStock })));
  }, [storeId, debouncedSearch, exportPdfData.length]);

  if (!profileLoading && !storeId) {
    return (
      <div className="container py-8 text-center text-muted-foreground">
        Please select a pharmacy to view inventory.
      </div>
    );
  }

  return (
    <div className="container py-4 flex flex-col gap-4 pb-24">
      <header className="flex justify-between items-center">
        <Button render={<Link href="/inventory/add-misc" />} className="font-bold shadow-xl shadow-primary/20 hidden sm:flex">
          <Plus size={18} className="mr-2" /> Add Misc Stock
        </Button>
      </header>


      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBar
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" disabled={exporting}>
                <Download size={18} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl" onClick={preparePdfExport}>
            <DropdownMenuItem
              onClick={handleExport}
              className="flex items-center gap-2 font-bold p-3 rounded-xl cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </DropdownMenuItem>
            <InventoryPDFButton data={exportPdfData} storeName={storeName} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>



      <div className="flex flex-col gap-4">
        {errorMsg && (
          <Card className="p-4 bg-red-500/10 border-red-500 text-red-600 font-medium">
            Error: {errorMsg}
          </Card>
        )}

        {loadingList ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : medicines.length === 0 ? (
          <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground bg-muted/20 border-dashed">
            <PackageSearch size={48} className="opacity-20" />
            <p>No medicines found matching your criteria.</p>
          </Card>
        ) : (
          medicines.map((med) => {
            const stockStatus = getStockStatus(med.totalStock, med.reorderLevel);
            const expiryStatus = med.overallExpiryStatus;

            return (
              <Card
                key={med.id}
                className={cn(
                  'hover:shadow-md transition-shadow relative overflow-hidden',
                  expiryStatus === 'expired' && 'border-red-500/50 bg-red-500/5'
                )}
              >
                {expiryStatus === 'expired' && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest shadow-lg">
                    Expired
                  </div>
                )}

                <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3">
                  <div className="grid gap-0.5">
                    <CardTitle className="text-base font-bold">{med.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{med.genericName}</p>
                  </div>
                  <Badge
                    variant={stockStatus === 'ok' ? 'default' : stockStatus === 'low' ? 'outline' : 'destructive'}
                    className={cn(
                      stockStatus === 'ok' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20',
                      stockStatus === 'low' && 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20'
                    )}
                  >
                    {med.totalStock} in stock
                  </Badge>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      {med.batches.map((batch: any, i: number) => (
                        <div
                          key={batch.id || i}
                          className={cn(
                            'text-[10px] px-2 py-1 rounded-md font-bold border',
                            batch.expiryStatus === 'expired' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                            batch.expiryStatus === 'critical' ? 'bg-orange-500/10 text-orange-600 border-orange-600/20' :
                            batch.expiryStatus === 'warning' ? 'bg-amber-500/10 text-amber-600 border-amber-600/20' :
                            'bg-muted text-muted-foreground border-border'
                          )}
                        >
                          {batch.batchNumber} ({batch.expiryDate})
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <span className="bg-muted px-2 py-0.5 rounded">Rack: {med.rack || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {expiryStatus === 'expired' ? <XCircle size={14} className="text-red-500" /> :
                         expiryStatus === 'critical' ? <AlertTriangle size={14} className="text-orange-500" /> :
                         expiryStatus === 'warning' ? <Clock size={14} className="text-amber-500" /> :
                         <ShieldCheck size={14} className="text-emerald-500" />}
                        <span className={cn(
                          'uppercase tracking-widest text-[10px]',
                          expiryStatus === 'expired' && 'text-red-500',
                          expiryStatus === 'critical' && 'text-orange-500',
                          expiryStatus === 'warning' && 'text-amber-500',
                          expiryStatus === 'ok' && 'text-emerald-500'
                        )}>
                          {expiryStatus === 'ok' ? 'Safe' : expiryStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loadingList}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} className="mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || loadingList}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      <FAB href="/purchases/scan" icon={<FileScan size={32} />} label="Add Stock" />
    </div>
  );
}
