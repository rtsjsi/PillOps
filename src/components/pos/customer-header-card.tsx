'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { GenericAutocomplete } from '@/components/ui/autocomplete';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

export interface CustomerHeaderData {
  customerName: string;
  customerPhone: string;
  doctorName: string;
  area: string;
  total: number;
}

interface CustomerHeaderCardProps {
  data: CustomerHeaderData;
  onChange: (field: keyof CustomerHeaderData, value: string) => void;
  customerNames?: string[];
  customerPhones?: string[];
  doctorNames?: string[];
  areas?: string[];
  warning?: string | null;
}

export function CustomerHeaderCard({
  data,
  onChange,
  customerNames = [],
  customerPhones = [],
  doctorNames = [],
  areas = [],
  warning,
}: CustomerHeaderCardProps) {
  return (
    <div className="mb-4">
      {/* Warning Banner */}
      {warning && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-2.5 rounded-lg mb-3 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <span>{warning}</span>
        </div>
      )}

      <Card className="bg-primary/5 border-primary/20 overflow-hidden shadow-sm">
        <CardContent className="p-3 grid grid-cols-2 md:grid-cols-5 gap-y-3 gap-x-3 items-end">
          
          {/* Customer Name */}
          <div className="space-y-1 col-span-2 md:col-span-1">
            <Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Customer</Label>
            <GenericAutocomplete
              placeholder="Name..."
              value={data.customerName}
              onValueChange={v => onChange('customerName', v)}
              options={customerNames}
              className="h-8 text-xs font-bold text-slate-900 bg-white"
            />
          </div>
          
          {/* Phone */}
          <div className="space-y-1 col-span-1">
            <Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Phone</Label>
            <GenericAutocomplete
              placeholder="Phone..."
              value={data.customerPhone}
              onValueChange={v => onChange('customerPhone', v)}
              options={customerPhones}
              className="h-8 text-xs font-bold text-slate-900 bg-white"
            />
          </div>
          
          {/* Doctor */}
          <div className="space-y-1 col-span-1">
            <Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Doctor</Label>
            <GenericAutocomplete
              placeholder="Doctor..."
              value={data.doctorName}
              onValueChange={v => onChange('doctorName', v)}
              options={doctorNames}
              className="h-8 text-xs font-bold text-slate-900 bg-white"
            />
          </div>

          {/* Area */}
          <div className="space-y-1 col-span-1">
            <Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Hospital/Area</Label>
            <GenericAutocomplete
              placeholder="Area..."
              value={data.area}
              onValueChange={v => onChange('area', v)}
              options={areas}
              className="h-8 text-xs font-bold text-slate-900 bg-white"
            />
          </div>
          
          {/* Net Amount */}
          <div className="space-y-1 col-span-2 md:col-span-1 md:text-right flex flex-col md:items-end justify-end">
            <Label className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Net Amount</Label>
            <p className="text-xl font-black text-emerald-600 tracking-tighter">{formatCurrency(data.total)}</p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
