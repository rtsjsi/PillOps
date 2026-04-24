import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', paddingBottom: '2rem' }}>
      <section style={{ marginTop: 'var(--space-4)' }}>
        <Skeleton width="180px" height="32px" />
        <div style={{ height: '8px' }} />
        <Skeleton width="220px" height="20px" />
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div className="glass-card" style={{ height: '180px' }} />
        <div className="glass-card" style={{ height: '220px' }} />
        <div className="glass-card" style={{ height: '80px' }} />
      </div>
    </div>
  );
}


