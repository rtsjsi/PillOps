'use client';

import { useEffect, useState } from 'react';
import { fetchInvoicesList } from '@/lib/queries';
import { useDebounce } from '@/hooks/use-debounce';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/searchBar';
import { formatCurrency } from '@/lib/utils';
import { History, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const InvoicePDFWrapper = dynamic(
  () => import('@/components/invoice/invoice-pdf-wrapper').then((mod) => mod.InvoicePDFWrapper),
  { ssr: false }
);

const RECENT_LIMIT = 20;

export default function POSLanding() {
  const [loading, setLoading] = useState(true);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const sales = await fetchInvoicesList({
          limit: RECENT_LIMIT,
          search: debouncedSearch,
        });
        if (!cancelled) setRecentSales(sales);
      } catch (error) {
        console.error('Failed to fetch sales data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [debouncedSearch]);



  return (
    <div className="container py-4 flex flex-col gap-4">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button render={<Link href="/pos/new" />} size="lg" className="font-bold">
            <Plus size={18} className="mr-2" />
            New Sale
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4 mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History size={20} className="text-muted-foreground" />
            <h2 className="text-xl font-bold tracking-tight">Recent Sales</h2>
          </div>
        </div>

        <SearchBar
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
          placeholder="Search customer, phone, or invoice #…"
        />

        <p className="text-xs text-muted-foreground font-medium">
          Showing last {RECENT_LIMIT} sales
          {debouncedSearch ? ` matching "${debouncedSearch}"` : ''}.
          {' '}
          <Link href="/reports/sales" className="text-primary hover:underline font-bold">
            View full register →
          </Link>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : recentSales.length === 0 ? (
            <div className="col-span-full p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl border-border/50 flex flex-col items-center justify-center gap-3">
              <History size={36} className="opacity-20" />
              <p className="font-medium">
                No recent sales{debouncedSearch ? ' matching your search' : ''} found.
              </p>
              {!debouncedSearch && (
                <Button render={<Link href="/pos/new" />} variant="outline">
                  Create your first sale
                </Button>
              )}
            </div>
          ) : (
            recentSales.map((inv) => (
              <Card key={inv.id} className="p-3 border-border shadow-sm flex flex-col gap-1.5">
                <div className="flex justify-between items-start">
                  <div className="font-bold text-sm line-clamp-1">{inv.customerName || 'Walk-in'}</div>
                  <div className="text-emerald-600 font-extrabold text-sm">{formatCurrency(inv.total)}</div>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground font-medium mt-auto pt-4 border-t border-border/50">
                  <div className="bg-muted px-2 py-1 rounded font-mono text-[10px]">#{inv.invoiceNumber}</div>
                  <div className="flex gap-1">
                    <Button render={<Link href={`/pos/${inv.id}/edit`} />} variant="ghost" size="sm" className="h-8 px-3 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      Edit
                    </Button>
                    <InvoicePDFWrapper
                      invoiceId={inv.id}
                      mode="download"
                      compact
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs font-bold"
                    />
                    <InvoicePDFWrapper
                      invoiceId={inv.id}
                      mode="print"
                      compact
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs font-bold"
                    />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
