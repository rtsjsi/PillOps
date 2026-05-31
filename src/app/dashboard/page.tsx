'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchMedicines, fetchSalesStats, fetchUserProfile, fetchStoreSettings, fetchDashboardStats } from '@/lib/queries';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  ShieldAlert,
  ShoppingCart,
  PlusCircle,
  FileScan,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { formatCurrency, cn, getDaysUntilExpiry, getExpiryStatus } from '@/lib/utils';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GlobalLoading from '@/app/loading';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [salesTrends, setSalesTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Get user profile to obtain store_id
        const profile = await fetchUserProfile();
        if (!profile?.store_id) {
          setErrorMsg('Unable to determine your store. Please contact support.');
          return;
        }

        // 2. Fetch everything in parallel using client-side queries
        const [dashStats, medsData, salesData] = await Promise.all([
          fetchDashboardStats(profile.store_id),
          fetchMedicines(),
          fetchSalesStats(),
        ]);

        setStats(dashStats);
        setMedicines(medsData || []);
        setSalesTrends(salesData || []);
      } catch (err: any) {
        console.error('Dashboard load failed:', err);
        setErrorMsg(err.message || 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    medicines.forEach(m => {
      counts[m.category] = (counts[m.category] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 categories
  }, [medicines]);

  // HSL colors mapping for PieChart
  const COLORS = [
    'hsl(var(--primary))',
    'hsl(199 89% 48%)', // blue
    'hsl(38 96% 54%)',  // warning/amber
    'hsl(283 39% 53%)', // purple
    'hsl(350 89% 60%)'  // danger/red
  ];

  const alerts = useMemo(() => {
    const list: any[] = [];
    medicines.forEach(med => {
      const totalQty = (med.batches ?? []).reduce((sum: number, b: any) => sum + b.quantity, 0);
      if (totalQty <= (med.reorder_level ?? med.reorderLevel ?? 0)) {
        list.push({ type: 'Low Stock', name: med.name, severity: 'warning', value: `${totalQty} left` });
      }
      (med.batches ?? []).forEach((b: any) => {
        const days = getDaysUntilExpiry(b.expiry_date ?? b.expiryDate);
        const status = getExpiryStatus(days);
        if (status === 'expired') {
          list.push({ type: 'Expired', name: `${med.name} (${b.batch_number ?? b.batchNumber})`, severity: 'error', value: 'Expired' });
        } else if (status === 'critical') {
          list.push({ type: 'Critical Expiry', name: `${med.name} (${b.batch_number ?? b.batchNumber})`, severity: 'error', value: `${days}d left` });
        }
      });
    });
    return list;
  }, [medicines]);

  const lowStockCount = alerts.filter(a => a.type === 'Low Stock').length;
  const expiryCount = alerts.filter(a => a.type !== 'Low Stock').length;

  if (loading) return <GlobalLoading />;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-card rounded-2xl border border-border">
        <AlertTriangle size={64} className="text-destructive mb-6" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md mb-8">{errorMsg}</p>
        <Button onClick={() => window.location.reload()} className="mt-6">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-page-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">Overview of your pharmacy operations today.</p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={() => router.push('/pos')} className="font-bold shadow-sm shadow-primary/20 rounded-xl h-10">
            <ShoppingCart size={16} className="mr-2" />
            New Sale
          </Button>
          <Button variant="outline" onClick={() => router.push('/purchases/scan')} className="font-bold rounded-xl h-10">
            <FileScan size={16} className="mr-2" />
            Scan Invoice
          </Button>
        </div>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          value={lowStockCount} 
          icon={AlertTriangle}
          iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-500"
        />
        <StatCard 
          label="Expiring Soon" 
          value={expiryCount} 
          icon={Clock}
          iconClassName="bg-destructive/10 text-destructive"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trends */}
        <Card className="lg:col-span-2 border-border shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Revenue Trends</CardTitle>
            <Badge variant="secondary" className="text-[10px] font-bold">Past 30 Days</Badge>
          </CardHeader>
          <CardContent className="h-[280px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrends} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} dy={10} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} tickFormatter={(val) => `₹${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="sales" name="Revenue" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Mix */}
        <Card className="border-border shadow-sm bg-card">
          <CardHeader>
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Stock Mix (Top 5)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] flex flex-col items-center justify-center pt-0">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontWeight: '600', color: 'hsl(var(--muted-foreground))' }}
                  />
                </PieChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
          {/* Action Required / Alerts */}
          <Card className="border-border shadow-sm bg-card flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
               <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                 <ShieldAlert size={18} className="text-destructive" />
                 Action Required
               </CardTitle>
               <Link href="/inventory" className="text-xs font-bold text-primary hover:underline">View All</Link>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col divide-y divide-border/50">
               {alerts.slice(0, 5).map((alert, i) => (
                  <div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                     <div className="flex items-center gap-3">
                       <div className={cn(
                         "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                         alert.severity === 'error' ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                       )}>
                         {alert.type === 'Low Stock' ? <Package size={18} /> : <Clock size={18} />}
                       </div>
                       <div className="min-w-0">
                         <p className="text-sm font-bold text-foreground truncate">{alert.name}</p>
                         <p className="text-xs text-muted-foreground">{alert.type}</p>
                       </div>
                     </div>
                     <div className="text-right shrink-0 ml-4">
                        <p className={cn(
                           "text-sm font-bold",
                           alert.severity === 'error' ? "text-destructive" : "text-amber-600"
                        )}>{alert.value}</p>
                     </div>
                  </div>
               ))}
               {alerts.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground flex-1 flex flex-col justify-center items-center gap-3">
                     <ShieldAlert size={32} className="opacity-20" />
                     <p className="text-sm font-medium">All clear! No pending alerts.</p>
                  </div>
               )}
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card className="border-border shadow-sm bg-card flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/50">
               <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                 <Receipt size={18} className="text-muted-foreground" />
                 Recent Sales
               </CardTitle>
               {/* No specific invoice index page exists yet, but could add link */}
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col divide-y divide-border/50">
               {stats?.recentInvoices?.slice(0, 5).map((inv: any) => (
                  <Link key={inv.id} href={`/invoice/${inv.id}`} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                     <div className="flex items-center gap-3">
                       <div className="h-10 w-10 rounded-full bg-muted border border-border text-muted-foreground flex items-center justify-center font-bold text-xs shrink-0">
                          {inv.customerName?.charAt(0)?.toUpperCase() || 'W'}
                       </div>
                       <div className="min-w-0">
                         <p className="text-sm font-bold text-foreground truncate">{inv.customerName || 'Walk-in Customer'}</p>
                         <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{inv.invoiceNumber}</p>
                       </div>
                     </div>
                     <div className="text-right shrink-0 ml-4">
                       <p className="text-sm font-bold text-primary">{formatCurrency(inv.total)}</p>
                       <p className="text-[10px] text-emerald-500 font-bold tracking-wide uppercase mt-0.5">Success</p>
                     </div>
                  </Link>
               ))}
               {(!stats?.recentInvoices || stats.recentInvoices.length === 0) && (
                  <div className="p-12 text-center text-muted-foreground flex-1 flex flex-col justify-center items-center gap-3">
                     <Receipt size={32} className="opacity-20" />
                     <p className="text-sm font-medium">No sales recorded yet today.</p>
                  </div>
               )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
