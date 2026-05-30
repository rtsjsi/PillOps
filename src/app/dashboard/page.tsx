'use client';

import { useEffect, useState, useMemo } from 'react';
import { getDashboardData } from '@/app/actions';
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
  const [activeTab, setActiveTab] = useState('Explore');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const result: any = await getDashboardData();
        if (result.error) {
           setErrorMsg(result.error);
        } else {
           setStats(result.stats);
           setMedicines(result.medicines || []);
           setSalesTrends(result.salesTrends || []);
        }
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
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [medicines]);

  const COLORS = ['#0d4a38', '#14b8a6', '#f59e0b', '#f43f5e', '#8b5cf6'];

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
          list.push({ type: 'Expired', name: `${med.name} (${b.batch_number ?? b.batchNumber})`, severity: 'error', value: b.expiry_date ?? b.expiryDate });
        } else if (status === 'critical') {
          list.push({ type: 'Critical Expiry', name: `${med.name} (${b.batch_number ?? b.batchNumber})`, severity: 'critical', value: `${days}d left` });
        }
      });
    });
    return list.slice(0, 5);
  }, [medicines]);

  if (loading) return <GlobalLoading />;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-zinc-50">
        <AlertTriangle size={64} className="text-destructive mb-6" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Something went wrong</h1>
        <p className="text-zinc-500 max-w-md mb-8">{errorMsg}</p>
        <p className="text-xs text-zinc-400">If this is a "SUPABASE_SERVICE_ROLE_KEY" error, ensure you have added the key to Cloudflare's dashboard variables and redeployed.</p>
        <Button onClick={() => window.location.reload()} className="mt-6">Try Again</Button>
      </div>
    );
  }

  const tabs = ['Explore', 'Holdings', 'Positions', 'Orders', 'My Watchlist'];

  return (
    <div className="flex flex-col gap-6 animate-page-in bg-white min-h-screen">
      {/* Index Ticker (Stat Cards) */}
      <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar px-1 -mx-1">
        <StatCard 
          label="NIFTY 50" 
          value="24,080.55" 
          trend={{ value: 12.15, isUp: false }}
          className="min-w-[160px] flex-shrink-0"
        />
        <StatCard 
          label="SENSEX" 
          value="77,153.59" 
          trend={{ value: 150.04, isUp: false }}
          className="min-w-[160px] flex-shrink-0"
        />
        <StatCard 
          label="TOTAL STOCK" 
          value={stats?.totalMedicines || 0} 
          trend={{ value: 5.2, isUp: true }}
          className="min-w-[160px] flex-shrink-0"
        />
        <StatCard 
          label="REVENUE" 
          value={formatCurrency(stats?.todaySales || 0)} 
          trend={{ value: 18.5, isUp: true }}
          className="min-w-[160px] flex-shrink-0"
        />
      </div>

      {/* Horizontal Tabs */}
      <div className="flex items-center gap-6 border-b border-zinc-100 overflow-x-auto no-scrollbar -mx-4 px-4">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "pb-3 text-sm font-bold transition-all whitespace-nowrap border-b-2 relative",
              activeTab === tab ? "text-primary border-primary" : "text-[#7c7e8c] border-transparent"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Explore' && (
        <div className="flex flex-col gap-8">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border border-zinc-100 shadow-none overflow-hidden bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold text-[#7c7e8c] uppercase tracking-wide">Revenue Trends</CardTitle>
                <Badge variant="secondary" className="text-[10px] bg-zinc-50 text-[#7c7e8c]">Past 30 Days</Badge>
              </CardHeader>
              <CardContent className="h-[250px] w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesTrends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    />
                    <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-zinc-100 shadow-none bg-white">
              <CardHeader>
                <CardTitle className="text-xs font-bold text-[#7c7e8c] uppercase tracking-wide">Stock Mix</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] flex flex-col items-center justify-center">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        innerRadius={50}
                        outerRadius={70}
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
              </CardContent>
            </Card>
          </div>

          {/* Lists Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
              <div className="flex flex-col gap-4">
                 <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[#44475b]">Critical Alerts</h2>
                    <Link href="/inventory" className="text-xs font-bold text-primary">See more</Link>
                 </div>
                 <div className="flex flex-col border border-zinc-100 rounded-xl overflow-hidden divide-y divide-zinc-50 bg-white">
                    {alerts.map((alert, i) => (
                       <div key={i} className="p-4 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-10 w-10 rounded-lg flex items-center justify-center",
                              alert.severity === 'error' ? "bg-rose-50 text-destructive" : "bg-amber-50 text-amber-600"
                            )}>
                              <ShieldAlert size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#44475b]">{alert.name}</p>
                              <p className="text-xs text-[#7c7e8c]">{alert.type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                             <p className={cn(
                                "text-sm font-bold",
                                alert.severity === 'error' ? "text-destructive" : "text-amber-600"
                             )}>{alert.value}</p>
                          </div>
                       </div>
                    ))}
                    {alerts.length === 0 && (
                       <div className="p-12 text-center text-muted-foreground">
                          <p className="text-sm">All clear! No alerts.</p>
                       </div>
                    )}
                 </div>
              </div>

              <div className="flex flex-col gap-4">
                 <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[#44475b]">Recent Transactions</h2>
                    <Link href="/invoice" className="text-xs font-bold text-primary">See more</Link>
                 </div>
                 <div className="flex flex-col border border-zinc-100 rounded-xl overflow-hidden divide-y divide-zinc-50 bg-white">
                    {stats?.recentInvoices.slice(0, 5).map((inv: any) => (
                       <Link key={inv.id} href={`/invoice/${inv.id}`} className="p-4 flex items-center justify-between hover:bg-zinc-50/50 transition-colors group">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-[#f2f2f2] text-[#44475b] flex items-center justify-center font-bold text-xs">
                               {inv.customerName?.charAt(0) || 'C'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#44475b]">{inv.customerName || 'Walk-in'}</p>
                              <p className="text-xs text-[#7c7e8c]">Inv: {inv.invoiceNumber}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">{formatCurrency(inv.total)}</p>
                            <p className="text-[10px] text-[#7c7e8c]">Success</p>
                          </div>
                       </Link>
                    ))}
                 </div>
              </div>
          </div>
        </div>
      )}

      {activeTab === 'Holdings' && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
           <PackageSearch size={64} className="text-zinc-100" />
           <div className="space-y-1">
             <h3 className="text-lg font-bold text-[#44475b]">No holdings found</h3>
             <p className="text-sm text-[#7c7e8c]">Your stock holdings will appear here.</p>
           </div>
        </div>
      )}
    </div>
  );
}
