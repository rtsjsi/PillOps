'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Download, AlertCircle } from 'lucide-react';
import { fetchInvoiceById, fetchStoreSettings } from '@/lib/queries';
import { numberToWords } from '@/lib/utils';
import { PDFDownloadLink, pdf, type DocumentProps } from '@react-pdf/renderer';
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
  const [mounted, setMounted] = React.useState(false);
  const [data, setData] = React.useState<{ invoice: any; storeInfo: any } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (!invoiceId) {
      setLoading(false);
      return;
    }

    const id = invoiceId;

    async function load() {
      try {
        const [inv, store] = await Promise.all([
          fetchInvoiceById(id),
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

  const loadingLabel = compact ? '...' : 'Preparing PDF...';

  if (!invoiceId) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Download size={compact ? 14 : 16} className={compact ? 'mr-1' : 'mr-2'} />
        {!compact && 'Download PDF Bill'}
      </Button>
    );
  }

  if (!mounted || loading) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Loader2 className={`h-4 w-4 animate-spin ${compact ? '' : 'mr-2'}`} />
        {!compact && loadingLabel}
      </Button>
    );
  }

  if (error || !data) {
    return (
      <Button variant="destructive" size={size} className={className} disabled>
        <AlertCircle className={`h-4 w-4 ${compact ? '' : 'mr-2'}`} />
        {!compact && 'Failed to load'}
      </Button>
    );
  }

  const { doc, invoiceNumber } = buildInvoiceDoc(data.invoice, data.storeInfo);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printInvoicePdf(doc);
    } catch (err) {
      console.error('Failed to print invoice PDF:', err);
    } finally {
      setPrinting(false);
    }
  };

  const printButton = (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={printing}
      onClick={handlePrint}
    >
      {printing ? (
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

  if (mode === 'print') {
    return printButton;
  }

  const downloadLink = (
    <PDFDownloadLink
      document={doc}
      fileName={`Invoice_${invoiceNumber}.pdf`}
      className={mode === 'both' ? 'no-underline' : 'no-underline w-full'}
    >
      {({ loading: pdfLoading }: { loading: boolean }) => (
        <Button variant={variant} size={size} className={className} disabled={pdfLoading}>
          {pdfLoading ? (
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
      )}
    </PDFDownloadLink>
  );

  if (mode === 'both') {
    return (
      <div className="flex items-center gap-2">
        {printButton}
        {downloadLink}
      </div>
    );
  }

  return downloadLink;
}
