'use client';

import { useEffect, useState, useMemo } from 'react';
import { getDashboardStats, getMedicines, getSalesStats } from '@/app/actions';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  ArrowRight, 
  ShieldAlert,
  ChevronRight,
  PackageSearch,
  ShoppingCart
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
  Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import GlobalLoading from '@/app/loading';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [salesTrends, setSalesTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsData, medicinesData, salesData] = await Promise.all([
          getDashboardStats(),
          getMedicines(),
          getSalesStats()
        ]);
        setStats(statsData);
        setMedicines(medicinesData);
        setSalesTrends(salesData);
      } catch (err) {
        console.error('Dashboard load failed:', err);
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
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [medicines]);

  const COLORS = ['#0d4a38', '#14b8a6', '#f59e0b', '#f43f5e', '#8b5cf6'];

  const alerts = useMemo(() => {
    const list: any[] = [];
    medicines.forEach(med => {
      const totalQty = med.batches.reduce((sum: number, b: any) => sum + b.quantity, 0);
      if (totalQty <= med.reorderLevel) {
        list.push({ type: 'Low Stock', name: med.name, severity: 'warning', value: `${totalQty} left` });
      }
      med.batches.forEach((b: any) => {
        const days = getDaysUntilExpiry(b.expiryDate);
        const status = getExpiryStatus(days);
        if (status === 'expired') {
          list.push({ type: 'Expired', name: `${med.name} (${b.batchNumber})`, severity: 'error', value: b.expiryDate });
        } else if (status === 'critical') {
          list.push({ type: 'Critical Expiry', name: `${med.name} (${b.batchNumber})`, severity: 'critical', value: `${days}d left` });
        }
      });
    });
    return list.slice(0, 5);
  }, [medicines]);

  if (loading) return <GlobalLoading />;

  return (
    <div className="flex flex-col gap-8 animate-page-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Clinical Overview</h1>
          <p className="text-muted-foreground font-medium">{stats?.storeName} • Control Center</p>
        </div>
        <div className="flex items-center gap-2">
            <Button render={<Link href="/pos" />} className="rounded-xl shadow-xl shadow-primary/20 h-11 px-6 font-bold">
                <ShoppingCart size={18} className="mr-2" />
                New Sale
            </Button>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total SKUs" 
          value={stats?.totalMedicines || 0} 
          icon={Package} 
          trend={{ value: 12, isUp: true }}
          description="Active catalog items"
        />
        <StatCard 
          label="Low Stock" 
          value={stats?.lowStockCount || 0} 
          icon={TrendingUp} 
          trend={{ value: 5, isUp: false }}
          description="Items below reorder level"
          className="ring-1 ring-amber-500/10"
        />
        <StatCard 
          label="Expiring Soon" 
          value={stats?.expiringCount || 0} 
          icon={Clock} 
          trend={{ value: 2, isUp: true }}
          description="Within 30 days"
          className="ring-1 ring-rose-500/10"
        />
        <StatCard 
          label="Today's Revenue" 
          value={formatCurrency(stats?.todaySales || 0)} 
          icon={ShieldAlert} 
          trend={{ value: 18, isUp: true }}
          description="Completed transactions"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Revenue Trends (Past 30 Days)</CardTitle>
            <Badge variant="outline" className="text-[10px] font-bold">Actual Sales Data</Badge>
          </CardHeader>
          <CardContent className="h-[300px] w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="sales" stroke="#0d4a38" strokeWidth={4} dot={{r: 4, fill: '#0d4a38', strokeWidth: 2, stroke: '#fff'}} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
            {salesTrends.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No sales data available for this period</p>
                </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Live Stock Mix</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
             </ResponsiveContainer>
             <div className="flex flex-wrap justify-center gap-4 mt-2">
                {categoryData.slice(0, 3).map((c, i) => (
                   <div key={i} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[10px] font-bold text-muted-foreground">{c.name}</span>
                   </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
          <Card className="border-none shadow-sm bg-white overflow-hidden">
             <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Critical Alerts
                </CardTitle>
                <Link href="/inventory" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">View All</Link>
             </CardHeader>
             <div className="divide-y divide-slate-50">
                {alerts.map((alert, i) => (
                   <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-xl",
                          alert.severity === 'error' ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-500"
                        )}>
                          <ShieldAlert size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{alert.name}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{alert.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] font-bold">{alert.value}</Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400">
                          <ArrowRight size={14} />
                        </Button>
                      </div>
                   </div>
                ))}
                {alerts.length === 0 && (
                   <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                      <PackageSearch size={32} className="opacity-20" />
                      <p className="text-sm font-medium">All clinical metrics are healthy.</p>
                   </div>
                )}
             </div>
          </Card>

          <Card className="border-none shadow-sm bg-white overflow-hidden">
             <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clock size={16} />
                  Verified Sales Activity
                </CardTitle>
             </CardHeader>
             <div className="divide-y divide-slate-50">
                {stats?.recentInvoices.slice(0, 5).map((inv: any) => (
                   <Link key={inv.id} href={`/invoice/${inv.id}`} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm">
                           {inv.customerName?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{inv.customerName || 'Walk-in Customer'}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Inv: {inv.invoiceNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-600">{formatCurrency(inv.total)}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Confirmed</p>
                        </div>
                        <ChevronRight size={16} className="text-zinc-300 group-hover:text-primary transition-colors" />
                      </div>
                   </Link>
                ))}
             </div>
          </Card>
      </div>
    </div>
  );
}
