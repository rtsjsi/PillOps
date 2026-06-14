'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, AlertCircle } from 'lucide-react';
import { fetchInvoiceById, fetchStoreSettings } from '@/lib/queries';
import { numberToWords } from '@/lib/utils';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { InvoicePDF } from './invoice-pdf';

export function InvoicePDFWrapper({ invoiceId, variant = 'default', size = 'default', className = '' }: any) {
  const [mounted, setMounted] = React.useState(false);
  const [data, setData] = React.useState<{ invoice: any, storeInfo: any } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (!invoiceId) return;
    
    async function load() {
      try {
        const [inv, store] = await Promise.all([
          fetchInvoiceById(invoiceId),
          fetchStoreSettings(),
        ]);
        if (!inv || !store) throw new Error('Failed to load data');
        setData({ invoice: inv, storeInfo: store });
      } catch (err) {
        console.error('Failed to load invoice for PDF:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId]);

  if (!mounted || loading) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Preparing PDF...
      </Button>
    );
  }

  if (error || !data) {
    return (
      <Button variant="destructive" size={size} className={className} disabled>
        <AlertCircle className="mr-2 h-4 w-4" />
        Failed to load
      </Button>
    );
  }

  const { invoice, storeInfo } = data;
  const totalQty = invoice.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const netAmount = Math.round(invoice.total);
  const roundOff = (netAmount - invoice.total).toFixed(2);
  const words = numberToWords(netAmount);

  const doc = (
    <InvoicePDF 
      invoice={invoice} 
      storeInfo={storeInfo} 
      words={words} 
      totalQty={totalQty} 
      roundOff={roundOff} 
      netAmount={netAmount} 
    />
  );

  return (
    <PDFDownloadLink 
      document={doc} 
      fileName={`Invoice_${invoice.invoiceNumber}.pdf`}
      className="no-underline w-full"
    >
      {({ loading: pdfLoading, url }: { loading: boolean, url: string | null }) => (
        <Button 
          variant={variant} 
          size={size} 
          className={className} 
          disabled={pdfLoading}
        >
          {pdfLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download size={16} className="mr-2" /> 
              Download PDF Bill
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
