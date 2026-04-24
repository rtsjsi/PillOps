'use client';

import { useState, useEffect } from 'react';
import { createStore, getAllStores } from '@/app/actions';
import { Card } from '@/components/ui/Card';
import { Building2, Plus, Store, Users, CheckCircle2, Loader2, Search } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

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

  if (loading) return <div className="flex-center" style={{ height: '100vh' }}>Loading Admin Panel...</div>;

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '90px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Super Admin Console</h1>
        <p className="text-muted">Manage pharmacies and onboarding</p>
      </header>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
         <Card className="flex-center" style={{ flexDirection: 'column', gap: '8px', padding: 'var(--space-4)' }}>
            <div style={{ color: 'var(--color-primary)' }}><Building2 size={24} /></div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Total Stores</div>
            <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{stores.length}</div>
         </Card>
         <Card className="flex-center" style={{ flexDirection: 'column', gap: '8px', padding: 'var(--space-4)' }}>
            <div style={{ color: 'var(--color-success)' }}><Users size={24} /></div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Active Subs</div>
            <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{stores.filter(s => s.subscriptionTier === 'pro').length}</div>
         </Card>
      </div>

      {/* Onboarding Form */}
      <section>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} /> Onboard New Store
        </h2>
        <Card>
          <form onSubmit={handleCreateStore} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <input 
                    className="input" 
                    placeholder="Pharmacy Name" 
                    required
                    value={newStore.name}
                    onChange={e => setNewStore({...newStore, name: e.target.value})}
                />
                <input 
                    className="input" 
                    placeholder="GSTIN" 
                    value={newStore.gstin}
                    onChange={e => setNewStore({...newStore, gstin: e.target.value})}
                />
                <input 
                    className="input" 
                    placeholder="Phone Number" 
                    required
                    value={newStore.phone}
                    onChange={e => setNewStore({...newStore, phone: e.target.value})}
                />
                <select 
                    className="input"
                    value={newStore.subscriptionTier}
                    onChange={e => setNewStore({...newStore, subscriptionTier: e.target.value})}
                    style={{ appearance: 'none' }}
                >
                    <option value="free">Free Tier</option>
                    <option value="pro">Pro Tier</option>
                    <option value="enterprise">Enterprise</option>
                </select>
            </div>
            <textarea 
                className="input" 
                placeholder="Full Address" 
                rows={2}
                value={newStore.address}
                onChange={e => setNewStore({...newStore, address: e.target.value})}
                style={{ resize: 'none' }}
            />
            
            <button 
                className="btn btn-primary" 
                disabled={isCreating}
                style={{ padding: '14px', borderRadius: '12px', display: 'flex', justifyContent: 'center', gap: '8px' }}
            >
                {isCreating ? <Loader2 className="animate-spin" /> : success ? <CheckCircle2 /> : 'Register Pharmacy Store'}
                {success && ' Success!'}
            </button>
          </form>
        </Card>
      </section>

      {/* Stores List */}
      <section>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Existing Pharmacies</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stores.map(store => (
                  <Card key={store.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ padding: '10px', background: 'var(--color-bg-primary)', borderRadius: '10px', color: 'var(--color-primary)' }}>
                              <Store size={20} />
                          </div>
                          <div>
                              <div style={{ fontWeight: 'bold' }}>{store.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Onboarded: {formatDate(store.createdAt)}</div>
                          </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '800', color: store.subscriptionTier === 'pro' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                              {store.subscriptionTier}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                              ID: {store.id.slice(0, 8)}...
                          </div>
                      </div>
                  </Card>
              ))}
          </div>
      </section>
    </div>
  );
}
