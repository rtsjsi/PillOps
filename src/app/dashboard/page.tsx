'use client';

import { useEffect, useState } from 'react';
import { fetchDashboardStats, fetchRecentPurchases } from '@/lib/queries';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  AlertTriangle,
  Clock,
  ShoppingCart,
  FileScan,
  TrendingUp,
  Receipt,
  Truck,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/contexts/user-profile-context';

function StatCardSkeleton() {
  return <Skeleton className="h-[88px] w-full rounded-xl" />;
}

function ListCardSkeleton({ title }: { title: string }) {
  return (
    <Card className="border-border shadow-sm bg-card flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
        <CardTitle className="text-lg font-bold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col divide-y divide-border/50">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();
  const [stats, setStats] = useState<any>(null);
  const [recentPurchases, setRecentPurchases] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profileLoading) return;

    if (!profile?.store_id) {
      if (profile?.role === 'super_admin') {
        setErrorMsg('Please select a pharmacy from the top bar to view its dashboard.');
      } else if (profile) {
        setErrorMsg('Unable to determine your store. Please contact support.');
      }
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    setDataLoading(true);
    setErrorMsg(null);

    Promise.all([
      fetchDashboardStats(profile.store_id),
      fetchRecentPurchases(5),
    ])
      .then(([dashStats, purchasesData]) => {
        if (cancelled) return;
        setStats(dashStats);
        setRecentPurchases(purchasesData);
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error('Dashboard load failed:', err);
        setErrorMsg(err.message || 'Unknown error occurred');
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile, profileLoading]);

  if (!profileLoading && errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-card rounded-2xl border border-border">
        <AlertTriangle size={64} className="text-destructive mb-6" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md mb-8">{errorMsg}</p>
        <Button onClick={() => window.location.reload()} className="mt-6">Try Again</Button>
      </div>
    );
  }

  const showSkeletons = profileLoading || dataLoading;

  return (
    <div className="flex flex-col gap-4 animate-page-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Overview of your pharmacy operations today.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => router.push('/pos')} className="font-bold shadow-sm shadow-primary/20 rounded-lg h-8">
            <ShoppingCart size={14} className="mr-1.5" />
            New Sale
          </Button>
          <Button variant="outline" onClick={() => router.push('/purchases/scan')} className="font-bold rounded-lg h-8">
            <FileScan size={14} className="mr-1.5" />
            Scan Invoice
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {showSkeletons ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Today's Sales"
              value={formatCurrency(stats?.todaySales || 0)}
              trend={{ value: 8.5, isUp: true }}
              icon={TrendingUp}
            />
            <StatCard
              label="Total Medicines"
              value={stats?.totalMedicines || 0}
              icon={Package}
              iconClassName="bg-blue-500/10 text-blue-500 dark:text-blue-400"
            />
            <StatCard
              label="Low Stock Items"
              value={stats?.lowStockCount || 0}
              icon={AlertTriangle}
              iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-500"
            />
            <StatCard
              label="Expiring Soon"
              value={stats?.expiringCount || 0}
              icon={Clock}
              iconClassName="bg-destructive/10 text-destructive"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">
        {showSkeletons ? (
          <>
            <ListCardSkeleton title="Recent Purchases" />
            <ListCardSkeleton title="Recent Sales" />
          </>
        ) : (
          <>
            <Card className="border-border shadow-sm bg-card flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Truck size={18} className="text-muted-foreground" />
                  Recent Purchases
                </CardTitle>
                <Link href="/purchases" className="text-xs font-bold text-primary hover:underline">View All</Link>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col divide-y divide-border/50">
                {recentPurchases.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/purchases/review?invoiceId=${inv.id}`}
                    className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center font-bold text-[10px] shrink-0">
                        {(inv.distributorName?.charAt(0) || 'P').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{inv.distributorName || 'Unknown Distributor'}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {inv.invoiceNumber ? `# ${inv.invoiceNumber}` : 'No Invoice #'}{inv.invoiceDate ? ` · ${formatDate(inv.invoiceDate)}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold text-primary">{formatCurrency(inv.total)}</p>
                    </div>
                  </Link>
                ))}
                {recentPurchases.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground flex-1 flex flex-col justify-center items-center gap-2">
                    <Truck size={28} className="opacity-20" />
                    <p className="text-sm font-medium">No purchases recorded yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm bg-card flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Receipt size={18} className="text-muted-foreground" />
                  Recent Sales
                </CardTitle>
                <Link href="/pos" className="text-xs font-bold text-primary hover:underline">New Sale</Link>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col divide-y divide-border/50">
                {stats?.recentInvoices?.slice(0, 5).map((inv: any) => (
                  <Link key={inv.id} href={`/invoice/${inv.id}`} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center font-bold text-[10px] shrink-0">
                        {inv.customerName?.charAt(0)?.toUpperCase() || 'W'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{inv.customerName || 'Walk-in Customer'}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{inv.invoiceNumber}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold text-primary">{formatCurrency(inv.total)}</p>
                    </div>
                  </Link>
                ))}
                {(!stats?.recentInvoices || stats.recentInvoices.length === 0) && (
                  <div className="p-8 text-center text-muted-foreground flex-1 flex flex-col justify-center items-center gap-2">
                    <Receipt size={28} className="opacity-20" />
                    <p className="text-sm font-medium">No sales recorded yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
