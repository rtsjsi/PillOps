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
  sticky = false,
}: InvoiceHeaderCardProps) {
  return (
    <div className={cn(sticky && "sticky top-0 z-30")}>
      {/* Duplicate / Warning Banner */}
      {warning && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-3 rounded-xl mb-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
          <span>{warning}</span>
        </div>
      )}

      <Card className="bg-primary/5 border-primary/20 overflow-hidden shadow-sm">
        <CardContent className="p-4 grid grid-cols-2 gap-y-4 gap-x-3">
          {/* Row 1: Distributor + Date */}
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <Label className={cn(
              "text-[10px] uppercase tracking-widest font-black text-muted-foreground",
              invalidFields.includes('distributorName') && "text-rose-500"
            )}>Distributor</Label>
            <GenericAutocomplete
              placeholder="Select or enter distributor..."
              value={data.distributorName}
              onValueChange={v => onChange('distributorName', v)}
              options={distributors}
              className={cn(
                "h-10 text-sm md:text-base font-bold text-slate-900 bg-white",
                invalidFields.includes('distributorName') && "border-rose-500 ring-rose-500 focus-visible:ring-rose-500"
              )}
            />
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-1 sm:text-right">
            <Label className={cn(
              "text-[10px] uppercase tracking-widest font-black text-muted-foreground",
              invalidFields.includes('invoiceDate') && "text-rose-500"
            )}>Date</Label>
            <Input
              type="date"
              value={data.invoiceDate}
              onChange={e => onChange('invoiceDate', e.target.value)}
              className={cn(
                "h-10 text-sm md:text-base font-bold text-slate-900 bg-white sm:text-right",
                invalidFields.includes('invoiceDate') && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
          </div>
          
          {/* Row 2: Invoice Number + Total */}
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <Label className={cn(
              "text-[10px] uppercase tracking-widest font-black text-muted-foreground",
              invalidFields.includes('invoiceNumber') && "text-rose-500"
            )}>Invoice Number</Label>
            <Input
              value={data.invoiceNumber}
              onChange={e => onChange('invoiceNumber', e.target.value)}
              className={cn(
                "h-10 text-sm md:text-base font-bold text-primary bg-white",
                invalidFields.includes('invoiceNumber') && "border-rose-500 focus-visible:ring-rose-500"
              )}
            />
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-1 sm:text-right">
            <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Net Amount</Label>
            <p className="text-2xl font-black text-emerald-600 tracking-tighter">{formatCurrency(data.total)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
