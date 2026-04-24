'use client';

import { useState, useEffect } from 'react';
import { createStore, getAllStores } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Plus, Store, Users, CheckCircle2, Loader2, Search, LayoutDashboard, UserPlus } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GenericTableLoading from '@/components/ui/TableLoading';

export default function AdminDashboard() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newStore, setNewStore] = useState({
    name: '',
    address: '',
    phone: '',
    gstin: '',
    subscriptionTier: 'pro'
  });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getAllStores();
        setStores(data);
      } catch (err) {
        console.error('Failed to load stores:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await createStore(newStore);
      setSuccess(true);
      const updated = await getAllStores();
      setStores(updated);
      setNewStore({ name: '', address: '', phone: '', gstin: '', subscriptionTier: 'pro' });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Creation failed:', err);
      alert('Failed to create store.');
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) return <GenericTableLoading />;

  return (
    <div className="container py-8 flex flex-col gap-8 pb-24">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Super Admin Console</h1>
        <p className="text-muted-foreground font-medium">Global management and tenant onboarding center.</p>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4">
         <Card className="flex flex-col items-center justify-center p-6 text-center gap-2 border-none bg-primary/5">
            <div className="text-primary bg-primary/10 p-3 rounded-2xl"><Building2 size={24} /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Stores</p>
              <p className="text-2xl font-extrabold">{stores.length}</p>
            </div>
         </Card>
         <Card className="flex flex-col items-center justify-center p-6 text-center gap-2 border-none bg-emerald-500/5">
            <div className="text-emerald-500 bg-emerald-500/10 p-3 rounded-2xl"><Users size={24} /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Pro</p>
              <p className="text-2xl font-extrabold">{stores.filter(s => s.subscriptionTier === 'pro').length}</p>
            </div>
         </Card>
      </div>

      {/* Onboarding Form */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <UserPlus size={20} className="text-muted-foreground" />
          <h2 className="text-xl font-bold tracking-tight">Onboard New Store</h2>
        </div>
        <Card className="border-primary/20 shadow-xl shadow-primary/5 overflow-hidden">
          <CardContent className="p-6">
            <form onSubmit={handleCreateStore} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Pharmacy Name</Label>
                    <Input 
                        id="name"
                        placeholder="e.g. Apollo Pharmacy" 
                        required
                        value={newStore.name}
                        onChange={e => setNewStore({...newStore, name: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gstin">GSTIN</Label>
                    <Input 
                        id="gstin"
                        placeholder="15-digit GST Number" 
                        value={newStore.gstin}
                        onChange={e => setNewStore({...newStore, gstin: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                        id="phone"
                        placeholder="+91 XXXXX XXXXX" 
                        required
                        value={newStore.phone}
                        onChange={e => setNewStore({...newStore, phone: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Subscription Tier</Label>
                    <Select 
                      value={newStore.subscriptionTier}
                      onValueChange={(v) => setNewStore({...newStore, subscriptionTier: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free Tier</SelectItem>
                        <SelectItem value="pro">Pro Tier</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Full Address</Label>
                <Input 
                    id="address"
                    placeholder="Physical location of the store" 
                    value={newStore.address}
                    onChange={e => setNewStore({...newStore, address: e.target.value})}
                />
              </div>
              
              <Button 
                  type="submit"
                  className="h-14 text-lg font-bold rounded-2xl shadow-lg shadow-primary/20"
                  disabled={isCreating}
              >
                  {isCreating ? <Loader2 className="mr-2 animate-spin" /> : success ? <CheckCircle2 className="mr-2" /> : null}
                  {success ? 'Store Registered Successfully!' : isCreating ? 'Registering...' : 'Complete Onboarding'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Stores List */}
      <section>
          <div className="flex items-center gap-2 mb-4">
            <LayoutDashboard size={20} className="text-muted-foreground" />
            <h2 className="text-xl font-bold tracking-tight">Existing Pharmacies</h2>
          </div>
          <div className="flex flex-col gap-3">
              {stores.map(store => (
                  <Card key={store.id} className="hover:shadow-md transition-all border-none shadow-sm">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-primary/10 rounded-xl text-primary shadow-inner">
                              <Store size={22} />
                          </div>
                          <div>
                              <p className="font-bold text-lg leading-tight">{store.name}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Joined: {formatDate(store.createdAt)}</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <Badge variant={store.subscriptionTier === 'pro' ? 'default' : 'outline'} className={store.subscriptionTier === 'pro' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                              {store.subscriptionTier.toUpperCase()}
                          </Badge>
                          <p className="text-[9px] font-mono text-muted-foreground mt-2 opacity-50">
                              ID: {store.id.slice(0, 12)}
                          </p>
                      </div>
                    </CardContent>
                  </Card>
              ))}
          </div>
      </section>
    </div>
  );
}
