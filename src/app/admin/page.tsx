'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { 
  getAllStores, 
  createStore, 
  updateStore, 
  deleteStore, 
  getStoreStats,
  getAllUsers,
  createUser,
  updateUserRole,
  updateUserStore,
  resetUserPassword,
  deleteUser
} from './actions';
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
  Filter,
  Key,
  ShieldAlert,
  Trash2,
  Edit,
  Building
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GlobalLoading from '@/app/loading';
import { StatCard } from '@/components/ui/stat-card';
import { toast } from 'sonner';

import { useSearchParams } from 'next/navigation';

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as 'stores' | 'users' || 'stores';
  const [activeTab, setActiveTab] = useState<'stores' | 'users'>(initialTab);
  
  // Data states
  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalStores: 0, totalUsers: 0, proStores: 0, enterpriseStores: 0 });
  const [loading, setLoading] = useState(true);
  
  // UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Form states
  const [newStore, setNewStore] = useState({ name: '', address: '', phone: '', gstin: '', subscriptionTier: 'pro' });
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'staff', storeId: '' });

  // Reset password states
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [storesRes, usersRes, statsRes] = await Promise.all([
        getAllStores(),
        getAllUsers(),
        getStoreStats()
      ]);
      
      if (storesRes.error) toast.error(storesRes.error);
      if (usersRes.error) toast.error(usersRes.error);
      if (statsRes.error) toast.error(statsRes.error);

      const storesData = storesRes.data || [];
      const usersData = usersRes.data || [];
      
      setStores(storesData);
      setUsers(usersData);
      setStats(statsRes.data || { totalStores: 0, totalUsers: 0, proStores: 0, enterpriseStores: 0, freeStores: 0 } as any);
      
      // Auto-select first store for new user if available
      if (storesData.length > 0 && !newUser.storeId) {
        setNewUser(prev => ({ ...prev, storeId: storesData[0].id }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }

  const filteredStores = useMemo(() => {
    return stores.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.gstin?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stores, searchQuery]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.storeName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  // Handlers for Stores
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await createStore(newStore);
      toast.success('Pharmacy onboarded successfully');
      setNewStore({ name: '', address: '', phone: '', gstin: '', subscriptionTier: 'pro' });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Store onboarding failed');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteStore = async (id: string) => {
    if (!confirm('Are you sure you want to delete this store?')) return;
    try {
      await deleteStore(id);
      toast.success('Store deleted successfully');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete store');
    }
  };

  // Handlers for Users
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await createUser(newUser);
      toast.success('User created successfully');
      setNewUser({ fullName: '', email: '', password: '', role: 'staff', storeId: stores[0]?.id || '' });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'User creation failed');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteUser(id);
      toast.success('User deleted successfully');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateUserRole(userId, newRole);
      toast.success('User role updated');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordId) return;
    setIsResetting(true);
    try {
      await resetUserPassword(resetPasswordId, newPassword);
      toast.success('Password reset successfully');
      setResetPasswordId(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Password reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) return <GlobalLoading />;

  return (
    <div className="flex flex-col gap-8 animate-page-in pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Super Admin</h1>
          <p className="text-muted-foreground font-medium italic">Global Tenant & User Management</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button 
            onClick={() => setActiveTab('stores')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'stores' ? "bg-white text-primary shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Building2 size={16} className="inline-block mr-2" />
            Pharmacies
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'users' ? "bg-white text-primary shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Users size={16} className="inline-block mr-2" />
            Users
          </button>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Tenants" 
          value={stats.totalStores} 
          className="ring-1 ring-primary/10"
        />
        <StatCard 
          label="Total Users" 
          value={stats.totalUsers} 
          className="ring-1 ring-indigo-500/10"
        />
        <StatCard 
          label="Active Pro" 
          value={stats.proStores} 
          className="ring-1 ring-emerald-500/10"
        />
        <StatCard 
          label="Enterprise" 
          value={stats.enterpriseStores} 
          className="ring-1 ring-amber-500/10"
        />
      </div>

      <div className="flex items-center justify-between mb-2 mt-4">
        <h2 className="text-xl font-bold tracking-tight">
          {activeTab === 'stores' ? 'Active Pharmacies' : 'System Users'}
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input 
            placeholder={`Search ${activeTab}...`}
            className="h-9 w-64 pl-9 text-xs rounded-full bg-white border-slate-200 shadow-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {activeTab === 'stores' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Onboarding Form */}
          <section className="lg:col-span-1 sticky top-24">
            <Card className="border-none shadow-xl shadow-primary/5 bg-white overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-primary/5">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <UserPlus size={16} /> Onboard New Store
                  </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleCreateStore} className="flex flex-col gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pharmacy Name</Label>
                    <Input required placeholder="e.g. Apollo Pharmacy" className="rounded-xl bg-slate-50 h-10"
                        value={newStore.name} onChange={e => setNewStore({...newStore, name: e.target.value})} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">GSTIN Number</Label>
                    <Input placeholder="15-digit ID" className="rounded-xl bg-slate-50 h-10"
                        value={newStore.gstin} onChange={e => setNewStore({...newStore, gstin: e.target.value})} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Contact Number</Label>
                    <Input placeholder="+91" className="rounded-xl bg-slate-50 h-10"
                        value={newStore.phone} onChange={e => setNewStore({...newStore, phone: e.target.value})} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subscription Tier</Label>
                    <Select value={newStore.subscriptionTier} onValueChange={(v) => setNewStore({...newStore, subscriptionTier: v || 'pro'})}>
                      <SelectTrigger className="rounded-xl bg-slate-50 h-10 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free Tier</SelectItem>
                        <SelectItem value="pro" className="text-emerald-600">Pro Tier</SelectItem>
                        <SelectItem value="enterprise" className="text-primary">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Address</Label>
                    <Input placeholder="Full Location" className="rounded-xl bg-slate-50 h-10"
                        value={newStore.address} onChange={e => setNewStore({...newStore, address: e.target.value})} />
                  </div>
                  
                  <Button type="submit" disabled={isCreating} className="h-12 mt-2 font-bold rounded-xl shadow-lg shadow-primary/20">
                      {isCreating ? <Loader2 className="mr-2 animate-spin" /> : <Building2 size={18} className="mr-2" />}
                      Onboard Pharmacy
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>

          {/* Stores List */}
          <section className="lg:col-span-2 space-y-4">
              {filteredStores.map(store => (
                  <Card key={store.id} className="hover:shadow-lg transition-all border-slate-200 shadow-sm bg-white group overflow-hidden">
                    <CardContent className="p-0 flex flex-col sm:flex-row">
                      <div className="p-5 flex-1 flex items-center gap-5">
                          <div className="p-3 bg-primary/5 rounded-2xl text-primary ring-1 ring-primary/10">
                              <Building2 size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-lg leading-tight truncate">{store.name}</h3>
                                  <Badge variant={store.subscriptionTier === 'pro' ? 'default' : 'outline'} className={cn(
                                      "text-[9px] font-black uppercase tracking-widest",
                                      store.subscriptionTier === 'pro' ? 'bg-emerald-500 hover:bg-emerald-600' : 
                                      store.subscriptionTier === 'enterprise' ? 'bg-primary hover:bg-primary/90' : ''
                                  )}>
                                      {store.subscriptionTier}
                                  </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{store.address || 'No address provided'}</p>
                              <div className="flex items-center gap-4 mt-2">
                                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                                      <ShieldCheck size={12} /> GSTIN: {store.gstin || 'N/A'}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                                      <Users size={12} /> Users: {store.userCount}
                                  </span>
                              </div>
                          </div>
                      </div>
                      <div className="px-5 py-4 border-l border-slate-100 flex items-center justify-center gap-2 bg-slate-50/50">
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-500 hover:bg-rose-50" onClick={() => handleDeleteStore(store.id)}>
                              <Trash2 size={16} />
                          </Button>
                      </div>
                    </CardContent>
                  </Card>
              ))}
              {filteredStores.length === 0 && (
                  <div className="p-16 text-center text-muted-foreground bg-white rounded-2xl border border-dashed border-slate-200">
                      <Store size={32} className="mx-auto mb-4 opacity-20" />
                      <p className="font-medium">No pharmacies found.</p>
                  </div>
              )}
          </section>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Create User Form */}
          <section className="lg:col-span-1 sticky top-24">
            <Card className="border-none shadow-xl shadow-indigo-500/5 bg-white overflow-hidden">
              <CardHeader className="bg-indigo-50 border-b border-indigo-100">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                    <UserPlus size={16} /> Create User Account
                  </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Full Name</Label>
                    <Input required placeholder="John Doe" className="rounded-xl bg-slate-50 h-10"
                        value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email (Login ID)</Label>
                    <Input type="email" required placeholder="john@pharmacy.com" className="rounded-xl bg-slate-50 h-10"
                        value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Temporary Password</Label>
                    <Input type="text" required placeholder="Min 8 chars" minLength={8} className="rounded-xl bg-slate-50 h-10"
                        value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Role</Label>
                    <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v || 'staff'})}>
                      <SelectTrigger className="rounded-xl bg-slate-50 h-10 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff (Pharmacist)</SelectItem>
                        <SelectItem value="owner" className="text-emerald-600">Store Owner</SelectItem>
                        <SelectItem value="super_admin" className="text-rose-600">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newUser.role !== 'super_admin' && (
                    <div className="grid gap-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Assign to Pharmacy</Label>
                      <Select value={newUser.storeId} onValueChange={(v) => setNewUser({...newUser, storeId: v || ''})}>
                        <SelectTrigger className="rounded-xl bg-slate-50 h-10 font-bold truncate">
                          <span className="truncate">{stores.find(s => s.id === newUser.storeId)?.name || "Select Store"}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {stores.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <Button type="submit" disabled={isCreating || (stores.length === 0 && newUser.role !== 'super_admin')} className="h-12 mt-2 font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20">
                      {isCreating ? <Loader2 className="mr-2 animate-spin" /> : <Users size={18} className="mr-2" />}
                      Create User
                  </Button>
                  {(stores.length === 0 && newUser.role !== 'super_admin') && (
                    <p className="text-[10px] text-rose-500 text-center mt-1">Please create a pharmacy first.</p>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Password Reset Modal/Form Block */}
            {resetPasswordId && (
              <Card className="mt-6 border-rose-200 bg-rose-50/50 shadow-xl shadow-rose-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-rose-700 flex items-center gap-2">
                    <Key size={16} /> Reset Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordReset} className="flex flex-col gap-3">
                    <p className="text-xs text-rose-600/80 mb-1">
                      Resetting password for user ID: <span className="font-mono">{resetPasswordId.split('-')[0]}...</span>
                    </p>
                    <Input 
                      type="text" 
                      placeholder="New password (min 8 chars)" 
                      required 
                      minLength={8}
                      className="h-10 border-rose-200 focus-visible:ring-rose-500"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setResetPasswordId(null)}>Cancel</Button>
                      <Button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-700" disabled={isResetting}>
                        {isResetting ? <Loader2 size={14} className="animate-spin" /> : 'Confirm Reset'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Users List */}
          <section className="lg:col-span-2 space-y-4">
              {filteredUsers.map(user => (
                  <Card key={user.id} className="hover:shadow-md transition-all border-slate-200 shadow-sm bg-white overflow-hidden">
                    <CardContent className="p-0 flex flex-col sm:flex-row">
                      <div className="p-5 flex-1 flex items-start gap-4">
                          <div className={cn(
                            "p-3 rounded-full text-white mt-1",
                            user.role === 'super_admin' ? "bg-rose-500 shadow-md shadow-rose-500/20" :
                            user.role === 'owner' ? "bg-emerald-500" : "bg-indigo-500"
                          )}>
                              {user.role === 'super_admin' ? <ShieldAlert size={18} /> : 
                               user.role === 'owner' ? <Building size={18} /> : <Users size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between mb-1">
                                  <h3 className="font-bold text-base leading-tight truncate">{user.fullName}</h3>
                                  <Select value={user.role} onValueChange={(r) => handleRoleChange(user.id, r)}>
                                    <SelectTrigger className="h-7 w-[120px] text-[10px] font-black uppercase tracking-widest bg-slate-50 border-none">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="staff">Staff</SelectItem>
                                      <SelectItem value="owner">Owner</SelectItem>
                                      <SelectItem value="super_admin">Super Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                              </div>
                              <p className="text-xs font-medium text-slate-500 truncate">{user.email}</p>
                              
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                                  <Badge variant="outline" className="text-[10px] font-bold text-slate-500 bg-slate-50 border-slate-200">
                                      <Store size={10} className="mr-1" /> {user.storeName}
                                  </Badge>
                                  <span className="text-[10px] font-medium text-slate-400">
                                      Created: {user.createdAt ? formatDate(user.createdAt) : 'N/A'}
                                  </span>
                              </div>
                          </div>
                      </div>
                      <div className="px-4 py-3 sm:py-4 border-t sm:border-t-0 sm:border-l border-slate-100 flex flex-row sm:flex-col items-center justify-center gap-2 bg-slate-50/50">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs font-bold h-8 border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200"
                            onClick={() => setResetPasswordId(user.id)}
                          >
                              <Key size={14} className="mr-1.5" /> Reset Pass
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full text-xs font-bold h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" 
                            onClick={() => handleDeleteUser(user.id)}
                          >
                              <Trash2 size={14} className="mr-1.5" /> Remove
                          </Button>
                      </div>
                    </CardContent>
                  </Card>
              ))}
              {filteredUsers.length === 0 && (
                  <div className="p-16 text-center text-muted-foreground bg-white rounded-2xl border border-dashed border-slate-200">
                      <Users size={32} className="mx-auto mb-4 opacity-20" />
                      <p className="font-medium">No users found.</p>
                  </div>
              )}
          </section>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
    return (
        <Suspense fallback={<GlobalLoading />}>
            <AdminDashboardContent />
        </Suspense>
    );
}
