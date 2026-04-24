import { getPurchases } from '@/app/actions';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileScan, Box } from 'lucide-react';
import Link from 'next/link';

export default async function Purchases() {
  const purchases = await getPurchases();

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '90px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Purchase History</h1>
      </header>

      {/* Hero Action */}
      <Card className="flex-center" style={{ flexDirection: 'column', gap: '16px', padding: '32px 16px', background: 'linear-gradient(135deg, var(--color-bg-card) 0%, rgba(13, 148, 136, 0.05) 100%)', border: '1px solid var(--color-primary-glow)' }}>
         <div style={{ background: 'var(--color-primary)', color: 'white', padding: '16px', borderRadius: '50%', boxShadow: '0 8px 24px var(--color-primary-glow)' }}>
            <FileScan size={32} />
         </div>
         <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>AI Invoice Scanner</h2>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '16px' }}>Instantly digitize distributor bills</p>
            <Link href="/purchases/scan" className="btn btn-primary" style={{ width: '100%' }}>
               Scan New Invoice
            </Link>
         </div>
      </Card>

      <section>
         <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Recent Inwards</h2>
         <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {purchases.length === 0 ? (
               <div className="flex-center" style={{ flexDirection: 'column', gap: '16px', opacity: 0.5, paddingTop: '32px' }}>
                  <Box size={40} />
                  <p>No purchase records yet.</p>
               </div>
            ) : (
               purchases.map((inv: any) => (
                  <Card key={inv.id}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 'bold' }}>{inv.distributorName}</div>
                        <div style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>{formatCurrency(inv.total)}</div>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        <div>Inv: {inv.invoiceNumber}</div>
                        <div>{formatDate(inv.invoiceDate)}</div>
                     </div>
                  </Card>
               ))
            )}
         </div>
      </section>
    </div>
  );
}
