import { getDashboardStats } from '@/app/actions';
import { getGreeting, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, PackageOpen, TrendingUp, Eye, LogOut } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function Dashboard() {
  try {
    const stats = await getDashboardStats();

    return (
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', paddingBottom: '2rem' }}>
        {/* Welcome Section */}
        <section style={{ marginTop: 'var(--space-4)' }}>
            <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-1)', letterSpacing: '-0.5px' }}>{getGreeting()} 👋</h1>
            <p className="text-muted" style={{ fontWeight: '500' }}>{stats.storeName}</p>
        </section>

        {/* Metrics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
           <Card className="flex-center" style={{ flexDirection: 'column', gap: '8px', padding: 'var(--space-3)' }}>
              <div style={{ color: 'var(--color-success)' }}><TrendingUp size={24} /></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Today Sales</div>
              <div style={{ fontWeight: 'bold' }}>{formatCurrency(stats.todaySales)}</div>
           </Card>
           <Card className="flex-center" style={{ flexDirection: 'column', gap: '8px', padding: 'var(--space-3)' }}>
              <div style={{ color: 'var(--color-warning)' }}><PackageOpen size={24} /></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Low Stock</div>
              <div style={{ fontWeight: 'bold' }}>{stats.lowStockCount}</div>
           </Card>
           <Card className="flex-center" style={{ flexDirection: 'column', gap: '8px', padding: 'var(--space-3)' }}>
              <div style={{ color: 'var(--color-danger)' }}><AlertTriangle size={24} /></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Expiring</div>
              <div style={{ fontWeight: 'bold' }}>{stats.expiringCount}</div>
           </Card>
        </div>

        {/* Quick Actions */}
        <section>
          <h2 style={{ fontSize: '1.2rem' }}>Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Link href="/pos" className="btn btn-primary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
               <span style={{ fontSize: '1.5rem' }}>🛒</span>
               New Sale
            </Link>
            <Link href="/purchases" className="btn btn-outline" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', border: '1px solid var(--color-primary)' }}>
               <span style={{ fontSize: '1.5rem' }}>📦</span>
               Inward Stock
            </Link>
          </div>
        </section>

        {/* Recent Sales */}
        <section>
           <h2 style={{ fontSize: '1.2rem' }}>Recent Sales</h2>
           <Card noPadding>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                 {stats.recentInvoices.map((inv: any, i: number) => (
                    <Link 
                      key={inv.id} 
                      href={`/invoice/${inv.id}`}
                      style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: 'var(--space-3)', 
                          borderBottom: i < stats.recentInvoices.length - 1 ? '1px solid rgba(107, 114, 128, 0.1)' : 'none',
                          textDecoration: 'none',
                          color: 'inherit'
                      }}
                    >
                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ padding: '8px', background: 'var(--color-bg-primary)', borderRadius: '8px', color: 'var(--color-primary)' }}>
                             <Eye size={16} />
                          </div>
                          <div>
                             <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{inv.invoiceNumber}</div>
                             <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{formatRelativeTime(inv.createdAt.toISOString())}</div>
                          </div>
                       </div>
                       <div style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>
                          {formatCurrency(inv.total)}
                       </div>
                    </Link>
                 ))}
                 {stats.recentInvoices.length === 0 && <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>No sales yet today.</div>}
              </div>
           </Card>
        </section>
      </div>
    );
  } catch (error: any) {
    const isProfileError = error.message?.includes('Store profile not found');
    
    return (
      <div className="container flex-center" style={{ minHeight: '70vh', flexDirection: 'column', gap: 'var(--space-5)', textAlign: 'center' }}>
        <div className="logo-icon" style={{ width: '80px', height: '80px', borderRadius: '24px', background: isProfileError ? 'var(--color-primary)' : 'var(--color-danger)' }}>
          <AlertTriangle size={40} color="white" />
        </div>
        
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>
            {isProfileError ? 'Account Setup Required' : 'Something went wrong'}
          </h1>
          <p className="text-muted" style={{ maxWidth: '450px' }}>
            {isProfileError 
              ? 'Your account is authenticated, but no pharmacy store profile was found in our database. This usually happens after a data clear.' 
              : 'An unexpected error occurred while loading your dashboard.'}
          </p>
        </div>

        {isProfileError && (
          <div className="glass-card" style={{ padding: 'var(--space-5)', border: '1px solid var(--color-primary)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-2)' }}>Next Steps:</h3>
            <ul style={{ textAlign: 'left', fontSize: '0.9rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>1. Run the database seed script to create demo data.</li>
              <li>2. Or, contact your system administrator to link your email to a store.</li>
            </ul>
          </div>
        )}

        <Link href="/login" className="btn btn-outline" style={{ marginTop: 'var(--space-4)' }}>
          Return to Login
        </Link>
      </div>
    );
  }
}

