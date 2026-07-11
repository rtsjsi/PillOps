'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, AlertCircle } from 'lucide-react';
import { fetchInvoiceById, fetchStoreSettings } from '@/lib/queries';
import { useUserProfile } from '@/contexts/user-profile-context';
import { numberToWords } from '@/lib/utils';
import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { InvoicePDF } from './invoice-pdf';

type InvoicePDFMode = 'download' | 'print' | 'both';

interface InvoicePDFWrapperProps {
  invoiceId: string | null | undefined;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
  mode?: InvoicePDFMode;
  compact?: boolean;
}

function buildInvoiceDoc(invoice: any, storeInfo: any) {
  const totalQty = invoice.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const netAmount = Math.round(invoice.total);
  const roundOff = (netAmount - invoice.total).toFixed(2);
  const words = numberToWords(netAmount);

  return {
    doc: (
      <InvoicePDF
        invoice={invoice}
        storeInfo={storeInfo}
        words={words}
        totalQty={totalQty}
        roundOff={roundOff}
        netAmount={netAmount}
      />
    ),
    invoiceNumber: invoice.invoiceNumber,
  };
}

async function printInvoicePdf(doc: React.ReactElement<DocumentProps>) {
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1500);
  };
}

export function InvoicePDFWrapper({
  invoiceId,
  variant = 'default',
  size = 'default',
  className = '',
  mode = 'download',
  compact = false,
}: InvoicePDFWrapperProps) {
  const { profile } = useUserProfile();
  const [mounted, setMounted] = React.useState(false);
  const [loadingAction, setLoadingAction] = React.useState<'print' | 'download' | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!invoiceId || !mounted) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        {mode === 'print' ? (
          <>
            <Printer size={compact ? 14 : 16} className={compact ? 'mr-1' : 'mr-2'} />
            {!compact && 'Print PDF'}
          </>
        ) : mode === 'download' ? (
          <>
            <Download size={compact ? 14 : 16} className={compact ? 'mr-1' : 'mr-2'} />
            {!compact && 'Download PDF Bill'}
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant={variant} size={size} className={className} disabled>
              <Printer size={compact ? 14 : 16} className={compact ? 'mr-1' : 'mr-2'} />
              {!compact && 'Print PDF'}
            </Button>
            <Button variant={variant} size={size} className={className} disabled>
              <Download size={compact ? 14 : 16} className={compact ? 'mr-1' : 'mr-2'} />
              {!compact && 'Download PDF Bill'}
            </Button>
          </div>
        )}
      </Button>
    );
  }

  const handleAction = async (action: 'print' | 'download') => {
    setLoadingAction(action);
    try {
      const inv = await fetchInvoiceById(invoiceId);
      const store = profile?.store ?? await fetchStoreSettings(profile?.store_id ?? undefined);
      if (!inv || !store) throw new Error('Failed to load data');
      
      const { doc, invoiceNumber } = buildInvoiceDoc(inv, store);

      if (action === 'print') {
        await printInvoicePdf(doc);
      } else {
        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice_${invoiceNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(`Failed to ${action} invoice PDF:`, err);
    } finally {
      setLoadingAction(null);
    }
  };

  const printButton = (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={loadingAction !== null}
      onClick={() => handleAction('print')}
    >
      {loadingAction === 'print' ? (
        <>
          <Loader2 className={`h-4 w-4 animate-spin ${compact ? '' : 'mr-2'}`} />
          {!compact && 'Printing...'}
        </>
      ) : (
        <>
          <Printer size={compact ? 14 : 16} className={compact ? 'mr-1' : 'mr-2'} />
          {compact ? 'Print' : 'Print PDF'}
        </>
      )}
    </Button>
  );

  const downloadButton = (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={loadingAction !== null}
      onClick={() => handleAction('download')}
    >
      {loadingAction === 'download' ? (
        <>
          <Loader2 className={`h-4 w-4 animate-spin ${compact ? '' : 'mr-2'}`} />
          {!compact && 'Generating...'}
        </>
      ) : (
        <>
          <Download size={compact ? 14 : 16} className={compact ? 'mr-1' : 'mr-2'} />
          {compact ? 'PDF' : 'Download PDF Bill'}
        </>
      )}
    </Button>
  );

  if (mode === 'print') return printButton;
  if (mode === 'both') {
    return (
      <div className="flex items-center gap-2">
        {printButton}
        {downloadButton}
      </div>
    );
  }
  return downloadButton;
}
