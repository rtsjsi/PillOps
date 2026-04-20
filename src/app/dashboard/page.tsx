'use client';

import { useEffect, useState } from 'react';
import { loadStore } from '@/lib/store';
import { StoreData, Medicine } from '@/lib/types';
import { getGreeting, formatCurrency, formatRelativeTime, getDaysUntilExpiry, getExpiryUrgency, formatExpiryDate, getStockStatus, getTotalStock } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IndianRupee, AlertTriangle, PackageOpen, TrendingUp, Eye } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [store, setStore] = useState<StoreData | null>(null);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  if (!store) return <div className="flex-center" style={{ height: '100vh' }}>Loading...</div>;

  // Calculate Metrics
  const todaySales = store.invoices
    .filter(inv => {
      const invDate = new Date(inv.createdAt);
      const today = new Date();
      return invDate.getDate() === today.getDate() && invDate.getMonth() === today.getMonth() && invDate.getFullYear() === today.getFullYear();
    })
    .reduce((sum, inv) => sum + inv.total, 0);

  // Expiry & Alerts logic
  interface AlertItem {
    id: string;
    medicineName: string;
    batchNumber: string;
    message: string;
    severity: 'danger' | 'warning' | 'info';
  }

  const alerts: AlertItem[] = [];
  let lowStockCount = 0;
  let expiringCount = 0;

  store.medicines.forEach(med => {
    const totalQty = getTotalStock(med.batches);
    const stockStatus = getStockStatus(totalQty, med.reorderLevel);

    if (stockStatus === 'out') {
      alerts.push({ id: `out-${med.id}`, medicineName: med.name, batchNumber: 'All', message: 'Out of stock', severity: 'danger' });
    } else if (stockStatus === 'low') {
      lowStockCount++;
      alerts.push({ id: `low-${med.id}`, medicineName: med.name, batchNumber: 'Total', message: `Only ${totalQty} left`, severity: 'info' });
    }

    med.batches.forEach(batch => {
      if (batch.quantity === 0) return;
      const daysLeft = getDaysUntilExpiry(batch.expiryDate);
      const urgency = getExpiryUrgency(daysLeft);
      
      if (urgency === 'expired') {
        alerts.push({ id: `exp-${batch.id}`, medicineName: med.name, batchNumber: batch.batchNumber, message: 'Expired!', severity: 'danger' });
      } else if (urgency === 'critical' || urgency === 'warning') {
        expiringCount++;
        if (urgency === 'critical') {
            alerts.push({ id: `exp-${batch.id}`, medicineName: med.name, batchNumber: batch.batchNumber, message: `Expiring in ${daysLeft} days`, severity: 'warning' });
        }
      }
    });
  });

  // Sort alerts: danger > warning > info
  const severityValue = { danger: 3, warning: 2, info: 1 };
  alerts.sort((a, b) => severityValue[b.severity] - severityValue[a.severity]);
  const displayAlerts = alerts.slice(0, 5); // Top 5 alerts

  // Recent Sales
  const recentSales = store.invoices.slice(0, 5);

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Header */}
      <header>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-1)' }}>{getGreeting()} 👋</h1>
        <p className="text-muted">{store.storeName}</p>
      </header>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
         <Card className="flex-center" style={{ flexDirection: 'column', gap: '8px', padding: 'var(--space-3)' }}>
            <div style={{ color: 'var(--color-success)' }}><TrendingUp size={24} /></div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Today Sales</div>
            <div style={{ fontWeight: 'bold' }}>₹{(todaySales/1000).toFixed(1)}k</div>
         </Card>
         <Card className="flex-center" style={{ flexDirection: 'column', gap: '8px', padding: 'var(--space-3)' }}>
            <div style={{ color: 'var(--color-warning)' }}><PackageOpen size={24} /></div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Low Stock</div>
            <div style={{ fontWeight: 'bold' }}>{lowStockCount}</div>
         </Card>
         <Card className="flex-center" style={{ flexDirection: 'column', gap: '8px', padding: 'var(--space-3)' }}>
            <div style={{ color: 'var(--color-danger)' }}><AlertTriangle size={24} /></div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Expiring</div>
            <div style={{ fontWeight: 'bold' }}>{expiringCount}</div>
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

      {/* Alerts */}
      <section>
        <h2 style={{ fontSize: '1.2rem' }}>Action Alerts</h2>
        {displayAlerts.length === 0 ? (
           <Card>
              <div className="text-muted" style={{ textAlign: 'center' }}>All caught up! No active alerts.</div>
           </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {displayAlerts.map(alert => (
              <Card key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{alert.medicineName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Batch: {alert.batchNumber}</div>
                </div>
                <Badge variant={alert.severity}>{alert.message}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recent Sales */}
      <section>
         <h2 style={{ fontSize: '1.2rem' }}>Recent Sales</h2>
         <Card noPadding>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               {recentSales.map((inv, i) => (
                  <Link 
                    key={inv.id} 
                    href={`/invoice/${inv.id}`}
                    style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: 'var(--space-3)', 
                        borderBottom: i < recentSales.length - 1 ? '1px solid rgba(107, 114, 128, 0.1)' : 'none',
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
                           <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{formatRelativeTime(inv.createdAt)}</div>
                        </div>
                     </div>
                     <div style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>
                        {formatCurrency(inv.total)}
                     </div>
                  </Link>
               ))}
               {recentSales.length === 0 && <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>No sales yet today.</div>}
            </div>
         </Card>
      </section>
    </div>
  );
}
