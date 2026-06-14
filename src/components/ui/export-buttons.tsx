'use client';

import { Button } from '@/components/ui/button';
import { FileText, TableProperties } from 'lucide-react';
import { exportToExcel, exportToPDF, ColumnDef } from '@/lib/export';

interface ExportButtonsProps {
  data: any[];
  columns: ColumnDef[];
  filename: string;
  title: string;
}

export function ExportButtons({ data, columns, filename, title }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        className="h-9 px-3 rounded-lg border-slate-200 text-slate-700 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 font-semibold shadow-sm"
        onClick={() => exportToPDF(data, columns, filename, title)}
        disabled={!data || data.length === 0}
      >
        <FileText size={16} className="mr-2" /> Export PDF
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        className="h-9 px-3 rounded-lg border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 font-semibold shadow-sm"
        onClick={() => exportToExcel(data, columns, filename)}
        disabled={!data || data.length === 0}
      >
        <TableProperties size={16} className="mr-2" /> Export Excel
      </Button>
    </div>
  );
}
