'use client';

import { useState, useEffect, useMemo } from 'react';
import { createStore, getAllStores } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Plus, 
  Store, 
  Users, 
  CheckCircle2, 
  Loader2, 
  Search, 
  LayoutDashboard, 
  UserPlus,
  ShieldCheck,
  CreditCard,
  MoreVertical,
  Filter
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GlobalLoading from '@/app/loading';
import { StatCard } from '@/components/ui/stat-card';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newStore, setNewStore] = useState({
    name: '',
    address: '',
    phone: '',
    gstin: '',
    subscriptionTier: 'pro'
  });

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getAllStores();
        setStores(data);
      } catch (err) {
        console.error('Failed to load stores:', err);
        toast.error('Failed to load pharmacy data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredStores = useMemo(() => {
    return stores.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.gstin?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stores, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: stores.length,
      pro: stores.filter(s => s.subscriptionTier === 'pro').length,
      enterprise: stores.filter(s => s.subscriptionTier === 'enterprise').length,
    };
  }, [stores]);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await createStore(newStore);
      toast.success('Pharmacy onboarded successfully');
      const updated = await getAllStores();
      setStores(updated);
      setNewStore({ name: '', address: '', phone: '', gstin: '', subscriptionTier: 'pro' });
    } catch (err: any) {
      toast.error(err.message || 'Onboarding failed');
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) return <GlobalLoading />;

  return (
    <div className="flex flex-col gap-8 animate-page-in pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Super Admin</h1>
          <p className="text-muted-foreground font-medium italic">Global Tenant & Store Management</p>
        </div>
        <div className="p-2 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3 px-4">
            <ShieldCheck className="text-primary" size={20} />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">System Integrity Verified</span>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          label="Total Tenants" 
          value={stats.total} 
          icon={Building2} 
          description="Registered pharmacy stores"
        />
        <StatCard 
          label="Active Pro" 
          value={stats.pro} 
          icon={CreditCard} 
          description="Paying subscriptions"
          className="ring-1 ring-emerald-500/10"
        />
        <StatCard 
          label="Enterprise" 
          value={stats.enterprise} 
          icon={LayoutDashboard} 
          description="High-volume entities"
          className="ring-1 ring-primary/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Onboarding Form */}
        <section className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus size={20} className="text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Onboard New Store</h2>
          </div>
          <Card className="border-none shadow-xl shadow-primary/5 bg-white overflow-hidden sticky top-24">
            <CardHeader className="bg-primary/5 border-b border-primary/5">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-primary">Tenant Credentials</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleCreateStore} className="flex flex-col gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider">Pharmacy Name</Label>
                  <Input 
                      id="name"
                      placeholder="e.g. Apollo Pharmacy" 
                      required
                      className="rounded-xl bg-slate-50 border-slate-200 h-11"
                      value={newStore.name}
                      onChange={e => setNewStore({...newStore, name: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gstin" className="text-xs font-bold uppercase tracking-wider">GSTIN Number</Label>
                  <Input 
                      id="gstin"
                      placeholder="15-digit ID" 
                      className="rounded-xl bg-slate-50 border-slate-200 h-11"
                      value={newStore.gstin}
                      onChange={e => setNewStore({...newStore, gstin: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider">Contact Number</Label>
                  <Input 
                      id="phone"
                      placeholder="+91" 
                      required
                      className="rounded-xl bg-slate-50 border-slate-200 h-11"
                      value={newStore.phone}
                      onChange={e => setNewStore({...newStore, phone: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider">Subscription Tier</Label>
                  <Select 
                    value={newStore.subscriptionTier}
                    onValueChange={(v) => setNewStore({...newStore, subscriptionTier: v || 'pro'})}
                  >
                    <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 h-11 font-bold">
                      <SelectValue placeholder="Select Plan" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl p-2">
                      <SelectItem value="free" className="font-bold rounded-lg p-3">Free Tier</SelectItem>
                      <SelectItem value="pro" className="font-bold rounded-lg p-3 text-emerald-600">Pro Tier</SelectItem>
                      <SelectItem value="enterprise" className="font-bold rounded-lg p-3 text-primary">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address" className="text-xs font-bold uppercase tracking-wider">Full Address</Label>
                  <Input 
                      id="address"
                      placeholder="Location" 
                      className="rounded-xl bg-slate-50 border-slate-200 h-11"
                      value={newStore.address}
                      onChange={e => setNewStore({...newStore, address: e.target.value})}
                  />
                </div>
                
                <Button 
                    type="submit"
                    className="h-14 text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 mt-4"
                    disabled={isCreating}
                >
                    {isCreating ? <Loader2 className="mr-2 animate-spin" /> : <Building2 size={18} className="mr-2" />}
                    {isCreating ? 'Onboarding...' : 'Onboard Pharmacy'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* Stores List */}
        <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Store size={20} className="text-muted-foreground" />
                <h2 className="text-xl font-bold tracking-tight">Active Pharmacies</h2>
              </div>
              <div className="flex items-center gap-2">
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                      <Input 
                          placeholder="Search stores..." 
                          className="h-9 w-48 pl-9 text-xs rounded-full bg-white border-slate-200"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                      />
                  </div>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                      <Filter size={14} />
                  </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
                {filteredStores.map(store => (
                    <Card key={store.id} className="hover:shadow-lg transition-all border-none shadow-sm bg-white group overflow-hidden">
                      <CardContent className="p-0 flex flex-col sm:flex-row">
                        <div className="p-6 flex-1 flex items-center gap-5">
                            <div className="p-4 bg-primary/5 rounded-2xl text-primary ring-1 ring-primary/10 group-hover:scale-110 transition-transform shadow-inner">
                                <Building2 size={24} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-black text-lg leading-tight truncate">{store.name}</h3>
                                    <Badge variant={store.subscriptionTier === 'pro' ? 'default' : 'outline'} className={cn(
                                        "text-[9px] font-black uppercase tracking-widest",
                                        store.subscriptionTier === 'pro' ? 'bg-emerald-500 hover:bg-emerald-600' : 
                                        store.subscriptionTier === 'enterprise' ? 'bg-primary hover:bg-primary/90' : ''
                                    )}>
                                        {store.subscriptionTier}
                                    </Badge>
                                </div>
                                <p className="text-xs font-medium text-muted-foreground truncate">{store.address}</p>
                                <div className="flex items-center gap-4 mt-3">
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                                        <ShieldCheck size={12} />
                                        GSTIN: {store.gstin || 'N/A'}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                                        <Users size={12} />
                                        Joined {formatDate(store.createdAt)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 sm:py-0 border-t sm:border-t-0 sm:border-l border-slate-50 flex items-center justify-between sm:justify-center gap-4 bg-slate-50/50">
                            <Button variant="secondary" size="sm" className="rounded-xl font-bold text-xs h-10 px-4">Manage</Button>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-300 hover:text-primary">
                                <MoreVertical size={18} />
                            </Button>
                        </div>
                      </CardContent>
                    </Card>
                ))}
                {filteredStores.length === 0 && (
                    <div className="p-24 text-center text-muted-foreground bg-white rounded-3xl border-2 border-dashed border-slate-100">
                        <Building2 size={48} className="mx-auto mb-4 opacity-10" />
                        <p className="font-bold italic">No matching pharmacies found.</p>
                    </div>
                )}
            </div>
        </section>
      </div>
    </div>
  );
}
