'use client';

import { useEffect, useState } from 'react';
import { loadStore, saveStore } from '@/lib/store';
import { StoreData, Medicine, Batch } from '@/lib/types';
import { getDaysUntilExpiry, getExpiryUrgency, formatExpiryDate, formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Clock } from 'lucide-react';

export default function ExpiryTracker() {
  const [store, setStore] = useState<StoreData | null>(null);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  if (!store) return <div className="flex-center" style={{ height: '100vh' }}>Loading...</div>;

  interface ExpiryDisplayItem {
     medicine: Medicine;
     batch: Batch;
     daysLeft: number;
     urgency: string;
     valueAtRisk: number;
  }

  const items: ExpiryDisplayItem[] = [];
  store.medicines.forEach(med => {
     med.batches.forEach(batch => {
        if (batch.quantity === 0) return;
        const daysLeft = getDaysUntilExpiry(batch.expiryDate);
        if (daysLeft <= 180) { // Only show up to Watch threshold
           items.push({
              medicine: med,
              batch: batch,
              daysLeft,
              urgency: getExpiryUrgency(daysLeft),
              valueAtRisk: batch.quantity * batch.purchasePrice
           });
        }
     });
  });

  // Sort by closest expiry
  items.sort((a, b) => a.daysLeft - b.daysLeft);

  const totalValueAtRisk = items.reduce((sum, item) => sum + item.valueAtRisk, 0);

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <header>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Expiry Radar</h1>
        <p className="text-muted">Track expiring batches</p>
      </header>

      <Card>
         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'var(--color-primary-glow)', padding: '16px', borderRadius: '50%', color: 'var(--color-primary)' }}>
               <Clock size={32} />
            </div>
            <div>
               <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Total Value at Risk</div>
               <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatCurrency(totalValueAtRisk)}</div>
               <div style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>{items.length} batches requiring attention</div>
            </div>
         </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
         {items.map(item => {
            const variantMap: Record<string, 'danger'|'warning'|'info'|'neutral'> = {
               'expired': 'danger',
               'critical': 'warning',
               'warning': 'info',
               'watch': 'neutral'
            };

            return (
               <Card key={item.batch.id} style={{ borderLeft: `4px solid var(--color-${variantMap[item.urgency] === 'info' ? 'primary' : variantMap[item.urgency] === 'neutral' ? 'text-muted' : variantMap[item.urgency]})` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                     <div style={{ fontWeight: 'bold' }}>{item.medicine.name}</div>
                     <Badge variant={variantMap[item.urgency]}>
                        {item.daysLeft <= 0 ? 'Expired' : `${item.daysLeft} days`}
                     </Badge>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                     <div><span className="text-muted">Batch:</span> {item.batch.batchNumber}</div>
                     <div><span className="text-muted">Expiry:</span> {formatExpiryDate(item.batch.expiryDate)}</div>
                     <div><span className="text-muted">Qty:</span> {item.batch.quantity}</div>
                     <div><span className="text-muted">Loss:</span> {formatCurrency(item.valueAtRisk)}</div>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                     <button className="btn btn-outline" style={{ flex: 1, padding: '6px' }}>Return</button>
                     <button className="btn btn-outline" style={{ flex: 1, padding: '6px', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>Dispose</button>
                  </div>
               </Card>
            );
         })}
         {items.length === 0 && <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>No batches expiring within 180 days.</div>}
      </div>
    </div>
  );
}
