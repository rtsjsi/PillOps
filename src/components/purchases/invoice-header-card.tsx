'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GenericAutocomplete } from '@/components/ui/autocomplete';
import { formatCurrency, cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

export interface InvoiceHeaderData {
  distributorName: string;
  invoiceDate: string;
  invoiceNumber: string;
  total: number;
}

interface InvoiceHeaderCardProps {
  data: InvoiceHeaderData;
  onChange: (field: keyof InvoiceHeaderData, value: string) => void;
  invalidFields?: string[];
  distributors?: string[];
  /** Warning message shown at the top of the card (e.g. duplicate detection) */
  warning?: string | null;
  /** Sticky positioning for scroll context */
  sticky?: boolean;
}

/**
 * Shared invoice header card used by both Review and Manual Entry pages.
 * Displays: Distributor, Invoice Date, Invoice Number, Net Total
 */
export function InvoiceHeaderCard({
  data,
  onChange,
  invalidFields = [],
  distributors = [],
  warning,
}: InvoiceHeaderCardProps) {
  return (
    <div className="mb-4">
      {/* Duplicate / Warning Banner */}
      {warning && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-2.5 rounded-lg mb-3 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <span>{warning}</span>
        </div>
      )}

      <Card className="bg-primary/5 border-primary/20 overflow-hidden shadow-sm">
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-3 items-end">
          {/* Row 1/Col 1: Distributor */}
          <div className="space-y-1 col-span-2 md:col-span-1">
            <Label className={cn(
              "text-[9px] uppercase tracking-widest font-black text-muted-foreground",
              invalidFields.includes('distributorName') && "text-rose-500"
            )}>Distributor</Label>
            <GenericAutocomplete
              value={data.distributorName}
              onValueChange={v => onChange('distributorName', v)}
              options={distributors}
              className={cn(
                "h-8 text-xs font-bold text-slate-900 bg-white",
                invalidFields.includes('distributorName') && "border-rose-500 ring-rose-500 focus-visible:ring-rose-500"
              )}
            />
          </div>
          
          {/* Row 2/Col 2: Date */}
          <div className="space-y-1 col-span-1">
            <Label className={cn(
              "text-[9px] uppercase tracking-widest font-black text-muted-foreground",
              invalidFields.includes('invoiceDate') && "text-rose-500"
            )}>Date</Label>
            <Input
              type="date"
              value={data.invoiceDate}
              onChange={e => onChange('invoiceDate', e.target.value)}
              className={cn(
                "h-8 text-xs font-bold text-slate-900 bg-white",
                invalidFields.includes('invoiceDate') && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
          </div>
          
          {/* Row 2/Col 3: Invoice Number */}
          <div className="space-y-1 col-span-1">
            <Label className={cn(
              "text-[9px] uppercase tracking-widest font-black text-muted-foreground",
              invalidFields.includes('invoiceNumber') && "text-rose-500"
            )}>Invoice Number</Label>
            <Input
              value={data.invoiceNumber}
              onChange={e => onChange('invoiceNumber', e.target.value)}
              className={cn(
                "h-8 text-xs font-bold text-primary bg-white",
                invalidFields.includes('invoiceNumber') && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
          </div>
          
          {/* Row 1/Col 4: Total */}
          <div className="space-y-1 col-span-2 md:col-span-1 md:text-right flex flex-col md:items-end justify-end">
            <Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Net Amount</Label>
            <p className="text-xl font-black text-emerald-600 tracking-tighter">{formatCurrency(data.total)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
