'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GenericAutocomplete } from '@/components/ui/autocomplete';
import { MedicineAutocomplete } from '@/components/purchases/medicine-autocomplete';
import { Trash2, Sparkles, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Sachet', 'OTC'];

export interface PurchaseItem {
  medicineName: string;
  extractedName?: string;
  batchNumber: string;
  expiryDate: string;
  purchasePrice: number;
  mrp: number;
  discountPercent: number;
  quantity: number;
  freeQuantity: number;
  manufacturer?: string;
  category?: string;
  hsnCode?: string;
  gstPercent?: number;
  totalAmount?: number;
  matchStatus?: 'exact' | 'probable' | 'none';
}

interface PurchaseItemCardProps {
  item: PurchaseItem;
  index: number;
  onChange: (idx: number, field: keyof PurchaseItem, value: any, fullItem?: any) => void;
  onRemove: (idx: number) => void;
  medicines: any[];
  manufacturers?: string[];
  canRemove?: boolean;
  hasError?: boolean;
  /** Show OCR-specific features like extracted name, match status, AI lookup */
  showMatchFeatures?: boolean;
  /** Callback for AI lookup */
  onAILookup?: (idx: number) => void;
  /** Callback for confirming probable match */
  onConfirmMatch?: (idx: number) => void;
  /** Whether AI is currently fetching for this item */
  isAIFetching?: boolean;
}

/**
 * Shared purchase item card used by both Review and Manual Entry pages.
 * 
 * Layout strategy (no collapse — all fields always visible):
 * - Colored left border indicates match status (green/amber/red)
 * - Medicine name spans full width as the primary identity
 * - Fields grouped into logical sections: Identity → Pricing → Quantity
 * - Responsive grid: 1-col mobile → 2-col tablet → 5-col desktop
 */
export function PurchaseItemCard({
  item,
  index,
  onChange,
  onRemove,
  medicines,
  manufacturers = [],
  canRemove = true,
  hasError = false,
  showMatchFeatures = false,
  onAILookup,
  onConfirmMatch,
  isAIFetching = false,
}: PurchaseItemCardProps) {
  // Determine card styling based on match status
  let borderColor = 'border-l-primary/40';
  let bgTint = '';
  
  if (hasError) {
    borderColor = 'border-l-rose-500';
    bgTint = 'bg-rose-50/30 dark:bg-rose-950/10';
  } else if (showMatchFeatures) {
    if (item.matchStatus === 'none') {
      borderColor = 'border-l-rose-500';
      bgTint = 'bg-rose-50/30 dark:bg-rose-950/10';
    } else if (item.matchStatus === 'probable') {
      borderColor = 'border-l-amber-500';
      bgTint = 'bg-amber-50/20 dark:bg-amber-950/10';
    } else if (item.matchStatus === 'exact') {
      borderColor = 'border-l-emerald-500';
      bgTint = '';
    }
  }

  const handleExpiryInput = (value: string) => {
    let v = value.replace(/\D/g, '').substring(0, 6);
    if (v.length >= 3) v = `${v.substring(0, 2)}-${v.substring(2, 6)}`;
    onChange(index, 'expiryDate', v);
  };

  return (
    <Card className={cn(
      "transition-all border-l-4 shadow-sm hover:shadow-md",
      borderColor,
      bgTint
    )}>
      {/* ─── Item Header: Number Badge + Medicine Name + Actions ─── */}
      <CardHeader className="p-3 pb-0 flex flex-row items-start gap-2 space-y-0">
        <span className={cn(
          "text-white text-[10px] font-black w-5 h-5 mt-2 flex items-center justify-center rounded-full shrink-0",
          hasError ? "bg-rose-500" :
          item.matchStatus === 'none' ? "bg-rose-500" :
          item.matchStatus === 'probable' ? "bg-amber-500" :
          item.matchStatus === 'exact' ? "bg-emerald-500" :
          "bg-primary"
        )}>
          {index + 1}
        </span>

        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          {/* Match status row (only for scan/review mode) */}
          {showMatchFeatures && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
              {item.extractedName && (
                <span className="text-muted-foreground flex items-center gap-1 max-w-full">
                  OCR: <span className="text-primary truncate max-w-[180px] sm:max-w-[280px]" title={item.extractedName}>{item.extractedName}</span>
                </span>
              )}
              {item.matchStatus === 'none' && (
                <span className="text-rose-500 bg-rose-100 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <AlertTriangle size={10} /> No Match
                </span>
              )}
              {item.matchStatus === 'probable' && (
                <span className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <AlertTriangle size={10} /> Probable
                </span>
              )}
              {item.matchStatus === 'exact' && (
                <span className="text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <CheckCircle2 size={10} /> Matched
                </span>
              )}
              {/* Action buttons */}
              {item.matchStatus === 'probable' && onConfirmMatch && (
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full shrink-0"
                  onClick={() => onConfirmMatch(index)}>✓ Confirm</Button>
              )}
              {(item.matchStatus === 'none' || item.matchStatus === 'probable') && onAILookup && (
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-full shrink-0"
                  onClick={() => onAILookup(index)} disabled={isAIFetching}>
                  {isAIFetching ? <Loader2 size={10} className="mr-1 animate-spin" /> : <Sparkles size={10} className="mr-1" />}
                  Ask AI
                </Button>
              )}
            </div>
          )}

          {/* Medicine name autocomplete — always full width */}
          <MedicineAutocomplete
            required
            value={item.medicineName}
            onChange={(val, fullItem) => onChange(index, 'medicineName', val, fullItem)}
            medicines={medicines}
          />
        </div>

        {canRemove && (
          <Button variant="ghost" size="icon" onClick={() => onRemove(index)}
            className="text-rose-500 hover:bg-rose-50 rounded-full shrink-0 mt-1 h-8 w-8">
            <Trash2 size={14} />
          </Button>
        )}
      </CardHeader>

      {/* ─── Item Fields ─── */}
      <CardContent className="p-3 pt-2">
        {/* 
          Responsive grid:
          - Mobile (default): 2 columns — compact but readable
          - Tablet (sm/md): 3-4 columns  
          - Desktop (lg+): 5 columns — full horizontal layout
          
          Fields grouped logically: Identity → Pricing → Quantity
        */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2 gap-y-2.5">
          {/* Identity Group */}
          <FieldCell label="Category">
            <Select value={item.category || ''} onValueChange={v => onChange(index, 'category', v)}>
              <SelectTrigger className="h-9 text-sm font-medium"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldCell>
          <FieldCell label="Manufacturer">
            <GenericAutocomplete
              placeholder="e.g. Cipla"
              value={item.manufacturer || ''}
              onValueChange={v => onChange(index, 'manufacturer', v)}
              options={manufacturers}
              className="h-9 text-sm font-medium"
            />
          </FieldCell>
          <FieldCell label="Batch">
            <Input value={item.batchNumber} onChange={e => onChange(index, 'batchNumber', e.target.value)} className="h-9 text-sm font-medium" />
          </FieldCell>
          <FieldCell label="Exp (MM-YYYY)">
            <Input placeholder="12-2025" value={item.expiryDate} onChange={e => handleExpiryInput(e.target.value)} className="h-9 text-sm font-medium" />
          </FieldCell>

          {/* Pricing Group */}
          <FieldCell label="Rate (₹)">
            <Input type="number" step="0.01" value={item.purchasePrice || ''} onChange={e => onChange(index, 'purchasePrice', parseFloat(e.target.value))} className="h-9 text-sm font-medium" />
          </FieldCell>
          <FieldCell label="MRP (₹)">
            <Input type="number" step="0.01" value={item.mrp || ''} onChange={e => onChange(index, 'mrp', parseFloat(e.target.value))} className="h-9 text-sm font-medium" />
          </FieldCell>
          <FieldCell label="Disc %">
            <Input type="number" step="0.1" value={item.discountPercent || ''} onChange={e => onChange(index, 'discountPercent', parseFloat(e.target.value))} className="h-9 text-sm font-medium" />
          </FieldCell>
          
          {/* Quantity Group */}
          <FieldCell label="Qty">
            <Input type="number" value={item.quantity || ''} onChange={e => onChange(index, 'quantity', parseInt(e.target.value))} className="h-9 text-sm font-medium" />
          </FieldCell>
          <FieldCell label="Free">
            <Input type="number" value={item.freeQuantity || ''} onChange={e => onChange(index, 'freeQuantity', parseInt(e.target.value))} className="h-9 text-sm font-medium" />
          </FieldCell>
          <FieldCell label="GST %">
            <Input type="number" step="0.1" value={item.gstPercent ?? ''} onChange={e => onChange(index, 'gstPercent', parseFloat(e.target.value))} className="h-9 text-sm font-medium" />
          </FieldCell>
        </div>
      </CardContent>
    </Card>
  );
}

/** Compact field wrapper with consistent label styling */
function FieldCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground leading-none">{label}</Label>
      {children}
    </div>
  );
}
