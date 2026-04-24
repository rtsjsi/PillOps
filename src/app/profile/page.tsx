import { getUserProfile, resetDatabase } from '@/app/actions';
import { Card } from '@/components/ui/Card';
import { User, Store, Mail, Phone, MapPin, CreditCard, Trash2, AlertTriangle } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const { user, profile } = await getUserProfile();

  async function handleReset() {
    'use server';
    await resetDatabase();
    redirect('/login');
  }


  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', paddingBottom: '2rem' }}>
      <section style={{ marginTop: 'var(--space-4)' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-1)', letterSpacing: '-0.5px' }}>Your Profile</h1>
        <p className="text-muted">Manage your account and store settings</p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-4)' }}>
        {/* User Info */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <div className="logo-icon" style={{ width: '64px', height: '64px', borderRadius: '20px' }}>
              <User size={32} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '2px' }}>{profile?.fullName || 'Pharmacist'}</h2>
              <p className="text-muted">{profile?.role?.toUpperCase()} • {user.email}</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Mail size={18} className="text-muted" />
              <span>{user.email}</span>
            </div>
          </div>
        </Card>

        {/* Store Info */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-4)' }}>
            <Store size={20} className="text-muted" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Store Information</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Store Name</label>
              <div style={{ fontWeight: '500' }}>{profile?.store?.name}</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MapPin size={18} className="text-muted" />
              <span>{profile?.store?.address || 'Not specified'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Phone size={18} className="text-muted" />
              <span>{profile?.store?.phone || 'Not specified'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CreditCard size={18} className="text-muted" />
              <span>GSTIN: {profile?.store?.gstin || 'Not specified'}</span>
            </div>
          </div>
        </Card>

        {/* Subscription */}
        <Card style={{ background: 'linear-gradient(135deg, var(--color-primary-glow), transparent)', border: '1px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>Subscription Plan</h3>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Your current billing cycle</p>
            </div>
            <div style={{ 
              background: 'var(--color-primary)', 
              color: 'white', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              fontSize: '0.8rem', 
              fontWeight: '700' 
            }}>
              {profile?.store?.subscriptionTier?.toUpperCase() || 'FREE'}
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card style={{ border: '1px solid var(--color-danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-4)', color: 'var(--color-danger)' }}>
            <AlertTriangle size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Danger Zone</h3>
          </div>
          <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-4)', color: 'var(--color-text-muted)' }}>
            This will permanently delete all medicines, batches, invoices, and your store profile. This action cannot be undone.
          </p>
          <form action={handleReset}>
            <button className="btn btn-primary" style={{ background: 'var(--color-danger)', width: '100%', gap: '8px' }}>
              <Trash2 size={18} /> Reset All Data
            </button>
          </form>
        </Card>
      </div>
    </div>

  );
}
