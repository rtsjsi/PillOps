import { Skeleton, CardSkeleton, TableRowSkeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', paddingBottom: '2rem' }}>
      {/* Welcome Section */}
      <section style={{ marginTop: 'var(--space-4)' }}>
        <Skeleton width="200px" height="32px" />
        <div style={{ height: '8px' }} />
        <Skeleton width="150px" height="20px" />
      </section>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
        <Skeleton height="100px" />
        <Skeleton height="100px" />
        <Skeleton height="100px" />
      </div>

      {/* Quick Actions */}
      <section>
        <Skeleton width="120px" height="24px" />
        <div style={{ height: '16px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Skeleton height="80px" />
          <Skeleton height="80px" />
        </div>
      </section>

      {/* Recent Sales */}
      <section>
        <Skeleton width="140px" height="24px" />
        <div style={{ height: '16px' }} />
        <div className="glass-card" style={{ padding: '0 var(--space-4)' }}>
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      </section>
    </div>
  );
}

