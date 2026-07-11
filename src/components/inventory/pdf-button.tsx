'use client';

import * as React from 'react';
import { FilePieChart, Loader2 } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { pdf } from '@react-pdf/renderer';

export function InventoryPDFButton({ data, storeName }: { data: any[], storeName: string }) {
  const [loading, setLoading] = React.useState(false);

  const handleDownload = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { InventoryReport } = await import('@/components/reports/inventory-report');
      const doc = <InventoryReport data={data} storeName={storeName} />;
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "inventory_report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate inventory PDF:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenuItem 
      onSelect={handleDownload} 
      disabled={loading} 
      className={`flex items-center gap-2 font-bold p-3 rounded-xl cursor-pointer ${loading ? 'opacity-50' : ''}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <FilePieChart size={16} />}
      {loading ? 'Generating...' : 'Export PDF'}
    </DropdownMenuItem>
  );
}
