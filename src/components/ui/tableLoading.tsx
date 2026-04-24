import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';

export default function GenericTableLoading() {
  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', paddingBottom: '2rem' }}>
      <section style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Skeleton width="180px" height="32px" />
          <div style={{ height: '8px' }} />
          <Skeleton width="220px" height="18px" />
        </div>
        <Skeleton width="120px" height="40px" borderRadius="10px" />
      </section>

      <div className="glass-card" style={{ padding: '0 var(--space-4)' }}>
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
      </div>
    </div>
  );
}


