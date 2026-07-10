'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchInvoiceById, fetchStoreSettings } from '@/lib/queries';
import { useUserProfile } from '@/contexts/user-profile-context';
import { numberToWords } from '@/lib/utils';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';

const InvoiceViewer = dynamic(
  () => import('@/components/invoice/invoice-pdf-viewer').then((mod) => mod.InvoiceViewer),
  { ssr: false }
);

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useUserProfile();
  const [invoice, setInvoice] = useState<any>(null);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const inv = await fetchInvoiceById(id);
        const store = profile?.store ?? await fetchStoreSettings(profile?.store_id ?? undefined);
        setInvoice(inv);
        setStoreInfo(store);
      } catch (err) {
        console.error('Failed to load invoice:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, profile]);

  if (loading) {
    return (
      <div className="container min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return (
        <div className="container min-h-screen flex flex-col items-center justify-center gap-6">
            <p className="text-muted-foreground font-medium">Invoice not found.</p>
            <Button render={<Link href="/pos" />} variant="outline">
              Back to POS
            </Button>
        </div>
    );
  }

  const totalQty = invoice.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const netAmount = Math.round(invoice.total);
  const roundOff = (netAmount - invoice.total).toFixed(2);
  const words = numberToWords(netAmount);

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100">
      <div className="p-4 bg-white border-b border-border flex items-center justify-between shrink-0">
          <Button render={<Link href="/pos" />} variant="ghost" className="font-bold">
              <ArrowLeft size={16} className="mr-2" /> Back to POS
          </Button>
          <h1 className="text-lg font-bold">Invoice #{invoice.invoiceNumber}</h1>
          <div className="w-[120px]"></div> {/* spacer */}
      </div>

      <div className="flex-1 w-full relative">
         <InvoiceViewer 
            invoice={invoice} 
            storeInfo={storeInfo} 
            words={words} 
            totalQty={totalQty} 
            roundOff={roundOff} 
            netAmount={netAmount} 
         />
      </div>
    </div>
  );
}
