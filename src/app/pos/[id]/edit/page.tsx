'use client';

import { use, useEffect, useState } from 'react';
import { POSForm } from '@/components/pos/pos-form';
import { fetchInvoiceById } from '@/lib/queries';
import GenericTableLoading from '@/components/ui/tableLoading';

export default function EditPOSPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        const data = await fetchInvoiceById(resolvedParams.id);
        setInitialData(data);
      } catch (error) {
        console.error('Failed to fetch invoice:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoice();
  }, [resolvedParams.id]);

  if (loading) return <GenericTableLoading />;

  if (!initialData) {
    return (
      <div className="container py-8 text-center text-muted-foreground">
        <p>Invoice not found.</p>
      </div>
    );
  }

  return <POSForm initialData={initialData} />;
}
