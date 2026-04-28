'use client';

import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { FilePieChart } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

const InventoryReport = dynamic(
  () => import('@/components/reports/inventory-report').then((mod) => mod.InventoryReport),
  { ssr: false }
);

export function InventoryPDFButton({ data, storeName }: { data: any[], storeName: string }) {
  return (
    <div className="p-0">
      <PDFDownloadLink 
        document={<InventoryReport data={data} storeName={storeName} />} 
        fileName="inventory_report.pdf"
      >
        {({ loading }: { loading: boolean }) => (
          <DropdownMenuItem className="flex items-center gap-2 font-bold p-3 rounded-xl cursor-pointer">
            <FilePieChart size={16} />
            {loading ? 'Preparing PDF...' : 'Export PDF'}
          </DropdownMenuItem>
        )}
      </PDFDownloadLink>
    </div>
  );
}
