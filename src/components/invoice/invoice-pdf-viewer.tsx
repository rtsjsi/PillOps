'use client';

import { PDFViewer } from '@react-pdf/renderer';
import { InvoicePDF } from './invoice-pdf';

export function InvoiceViewer({ invoice, storeInfo, words, totalQty, roundOff, netAmount }: any) {
  return (
    <PDFViewer className="w-full h-full border-none">
      <InvoicePDF 
        invoice={invoice} 
        storeInfo={storeInfo} 
        words={words} 
        totalQty={totalQty} 
        roundOff={roundOff} 
        netAmount={netAmount} 
      />
    </PDFViewer>
  );
}
