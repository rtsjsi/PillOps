'use client';

import * as React from 'react';
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
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <DropdownMenuItem className="flex items-center gap-2 font-bold p-3 rounded-xl cursor-not-allowed opacity-50">
        <FilePieChart size={16} />
        Loading...
      </DropdownMenuItem>
    );
  }

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
