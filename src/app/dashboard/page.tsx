import { getDashboardStats } from '@/app/actions';
import { getGreeting, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, PackageOpen, TrendingUp, Eye, ShoppingCart, Box } from 'lucide-react';
import Link from 'next/link';
import DashboardError from '@/components/dashboard/DashboardError';
import { Button } from '@/components/ui/button';

export default async function Dashboard() {
  try {
    const stats = await getDashboardStats();

    return (
      <div className="container py-8 flex flex-col gap-8">
        {/* Welcome Section */}
        <section>
            <h1 className="text-3xl font-bold tracking-tight">{getGreeting()} 👋</h1>
            <p className="text-muted-foreground font-medium">{stats.storeName}</p>
        </section>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <Card className="flex flex-col items-center justify-center p-6 text-center gap-2">
              <div className="text-emerald-500 bg-emerald-500/10 p-3 rounded-xl"><TrendingUp size={28} /></div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Today Sales</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.todaySales)}</p>
              </div>
           </Card>
           <Card className="flex flex-col items-center justify-center p-6 text-center gap-2">
              <div className="text-amber-500 bg-amber-500/10 p-3 rounded-xl"><PackageOpen size={28} /></div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Low Stock</p>
                <p className="text-2xl font-bold">{stats.lowStockCount}</p>
              </div>
           </Card>
           <Card className="flex flex-col items-center justify-center p-6 text-center gap-2">
              <div className="text-red-500 bg-red-500/10 p-3 rounded-xl"><AlertTriangle size={28} /></div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Expiring</p>
                <p className="text-2xl font-bold">{stats.expiringCount}</p>
              </div>
           </Card>
        </div>

        {/* Quick Actions */}
        <section>
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <Button asChild variant="default" className="h-24 flex flex-col gap-2 rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              <Link href="/pos">
                <ShoppingCart size={24} />
                <span>New Sale</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl border-primary text-primary hover:bg-primary/10 transition-all">
              <Link href="/purchases">
                <Box size={24} />
                <span>Inward Stock</span>
              </Link>
            </Button>
          </div>
        </section>

        {/* Recent Sales */}
        <section>
           <h2 className="text-xl font-bold mb-4">Recent Sales</h2>
           <Card className="overflow-hidden">
              <div className="divide-y divide-border">
                 {stats.recentInvoices.map((inv: any) => (
                    <Link 
                      key={inv.id} 
                      href={`/invoice/${inv.id}`}
                      className="flex justify-between items-center p-4 hover:bg-muted/50 transition-colors"
                    >
                       <div className="flex items-center gap-4">
                          <div className="p-2 bg-primary/10 rounded-lg text-primary">
                             <Eye size={18} />
                          </div>
                          <div>
                             <p className="font-bold text-sm">{inv.invoiceNumber}</p>
                             <p className="text-xs text-muted-foreground">{formatRelativeTime(inv.createdAt.toISOString())}</p>
                          </div>
                       </div>
                       <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(inv.total)}
                       </div>
                    </Link>
                 ))}
                 {stats.recentInvoices.length === 0 && (
                   <div className="p-8 text-center text-muted-foreground">No sales yet today.</div>
                 )}
              </div>
           </Card>
        </section>
      </div>
    );
  } catch (error: any) {
    const isProfileError = error.message?.includes('Store profile not found');
    return <DashboardError isProfileError={!!isProfileError} />;
  }
}
