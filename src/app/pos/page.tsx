'use client';

import { useEffect, useState } from 'react';
import { fetchInvoices } from '@/lib/queries';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Printer, History, Plus } from 'lucide-react';
import GenericTableLoading from '@/components/ui/tableLoading';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function POSLanding() {
  const [loading, setLoading] = useState(true);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const sales = await fetchInvoices(20);
        setRecentSales(sales);
      } catch (error) {
        console.error('Failed to fetch sales data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useKeyboardShortcuts([
    {
      key: 'F2',
      action: () => router.push('/pos/new'),
      description: 'New Sale'
    }
  ]);

  if (loading) return <GenericTableLoading />;

  return (
    <div className="container py-4 flex flex-col gap-4">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
            <span><kbd className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">F2</kbd> New Sale</span>
          </div>
          <Button render={<Link href="/pos/new" />} size="lg" className="font-bold">
              <Plus size={18} className="mr-2" />
              New Sale
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4 mt-4">
        <div className="flex items-center gap-2">
           <History size={20} className="text-muted-foreground" />
           <h2 className="text-xl font-bold tracking-tight">Recent Sales</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {recentSales.map((inv) => (
             <Card key={inv.id} className="p-3 border-border shadow-sm flex flex-col gap-1.5">
               <div className="flex justify-between items-start">
                  <div className="font-bold text-sm line-clamp-1">{inv.customerName || 'Walk-in'}</div>
                  <div className="text-emerald-600 font-extrabold text-sm">{formatCurrency(inv.total)}</div>
               </div>
               <div className="flex justify-between items-center text-xs text-muted-foreground font-medium mt-auto pt-4 border-t border-border/50">
                  <div className="bg-muted px-2 py-1 rounded font-mono text-[10px]">#{inv.invoiceNumber}</div>
                  <Button render={<Link href={`/invoice/${inv.id}`} />} variant="ghost" size="sm" className="h-8 px-3 text-xs font-bold">
                       <Printer size={14} className="mr-1.5" /> Print
                  </Button>
               </div>
             </Card>
          ))}
          {recentSales.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl border-border/50 flex flex-col items-center justify-center gap-3">
              <History size={36} className="opacity-20" />
              <p className="font-medium">No recent sales found.</p>
              <Button render={<Link href="/pos/new" />} variant="outline">
                Create your first sale
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
