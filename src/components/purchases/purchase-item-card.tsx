'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GenericAutocomplete } from '@/components/ui/autocomplete';
import { MedicineAutocomplete } from '@/components/purchases/medicine-autocomplete';
import { Trash2, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { calculatePurchaseLineAmount } from '@/lib/purchase-calculations';

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
}

/**
 * Purchase item card with "Trust & Flag" design.
 * 
 * Only 2 visual states:
 * - Default (no special styling) — medicine name is filled, all good
 * - Needs Attention (amber left border) — medicine name is empty or too short
 * 
 * The medicine autocomplete IS the matching UI. No separate match status badges,
 * no AI buttons, no confirm buttons. Users type → autocomplete finds it → done.
 * If it's a new medicine, they just leave the name as-is and it auto-creates on save.
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
}: PurchaseItemCardProps) {
  const needsAttention = !item.medicineName || item.medicineName.trim().length < 3;

  let borderColor = 'border-l-slate-200 dark:border-l-slate-700';
  let bgTint = '';
  
  if (hasError) {
    borderColor = 'border-l-rose-500';
    bgTint = 'bg-rose-50/30 dark:bg-rose-950/10';
  } else if (needsAttention) {
    borderColor = 'border-l-amber-400';
    bgTint = 'bg-amber-50/20 dark:bg-amber-950/10';
  }

  const handleExpiryInput = (value: string) => {
    let v = value.replace(/\D/g, '').substring(0, 6);
    if (v.length >= 3) v = `${v.substring(0, 2)}-${v.substring(2, 6)}`;
    onChange(index, 'expiryDate', v);
  };

  const isBatchNumberInvalid = hasError && !item.batchNumber;
  const isExpiryDateInvalid = hasError && (!item.expiryDate || !/^(0[1-9]|1[0-2])-\d{4}$/.test(item.expiryDate));
  const isQuantityInvalid = hasError && (item.quantity === undefined || item.quantity === null || isNaN(item.quantity));
  const isPurchasePriceInvalid = hasError && (item.purchasePrice === undefined || item.purchasePrice === null || isNaN(item.purchasePrice));
  const isMrpInvalid = hasError && (item.mrp === undefined || item.mrp === null || isNaN(item.mrp));
  const lineTotal = calculatePurchaseLineAmount(item).totalAmount;

  const parseDecimal = (raw: string) => {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const parseWhole = (raw: string) => {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <Card className={cn(
      "transition-all border-l-4 shadow-sm hover:shadow-md",
      borderColor,
      bgTint
    )}>
      {/* ─── Item Header: Number + Medicine Name + Delete ─── */}
      <CardHeader className="p-3 pb-0 flex flex-row items-center gap-2 space-y-0">
        <span className={cn(
          "text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shrink-0",
          hasError ? "bg-rose-500" : needsAttention ? "bg-amber-400" : "bg-slate-500"
        )}>
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          {needsAttention && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 mb-1">
              <AlertTriangle size={10} />
              <span>Select or type medicine name</span>
            </div>
          )}
          <MedicineAutocomplete
            required
            value={item.medicineName}
            onChange={(val, fullItem) => onChange(index, 'medicineName', val, fullItem)}
            medicines={medicines}
          />
        </div>

        {canRemove && (
          <Button variant="ghost" size="icon" onClick={() => onRemove(index)}
            className="text-rose-500 hover:bg-rose-50 rounded-full shrink-0 h-8 w-8">
            <Trash2 size={14} />
          </Button>
        )}
      </CardHeader>

      {/* ─── Item Fields ─── */}
      <CardContent className="p-3 pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2 gap-y-2.5">
          <FieldCell label="Category">
            <Select value={item.category || ''} onValueChange={v => onChange(index, 'category', v)}>
              <SelectTrigger className="h-9 text-sm font-medium"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldCell>
          <FieldCell label="Manufacturer">
            <GenericAutocomplete
              value={item.manufacturer || ''}
              onValueChange={v => onChange(index, 'manufacturer', v)}
              options={manufacturers}
              className="h-9 text-sm font-medium"
            />
          </FieldCell>
          <FieldCell label="Batch" error={isBatchNumberInvalid}>
            <Input 
              value={item.batchNumber} 
              onChange={e => onChange(index, 'batchNumber', e.target.value)} 
              className={cn("h-9 text-sm font-medium", isBatchNumberInvalid && "border-rose-500 focus-visible:ring-rose-500")} 
            />
          </FieldCell>
          <FieldCell label="Exp (MM-YYYY)" error={isExpiryDateInvalid}>
            <Input 
              value={item.expiryDate} 
              onChange={e => handleExpiryInput(e.target.value)} 
              className={cn("h-9 text-sm font-medium", isExpiryDateInvalid && "border-rose-500 focus-visible:ring-rose-500")} 
            />
          </FieldCell>
          <FieldCell label="Rate (₹)" error={isPurchasePriceInvalid}>
            <Input 
              type="number" 
              step="0.01" 
              value={item.purchasePrice || ''} 
              onChange={e => onChange(index, 'purchasePrice', parseDecimal(e.target.value))} 
              className={cn("h-9 text-sm font-medium", isPurchasePriceInvalid && "border-rose-500 focus-visible:ring-rose-500")} 
            />
          </FieldCell>
          <FieldCell label="MRP (₹)" error={isMrpInvalid}>
            <Input 
              type="number" 
              step="0.01" 
              value={item.mrp || ''} 
              onChange={e => onChange(index, 'mrp', parseDecimal(e.target.value))} 
              className={cn("h-9 text-sm font-medium", isMrpInvalid && "border-rose-500 focus-visible:ring-rose-500")} 
            />
          </FieldCell>
          <FieldCell label="Disc %">
            <Input type="number" step="0.1" value={item.discountPercent || ''} onChange={e => onChange(index, 'discountPercent', parseDecimal(e.target.value))} className="h-9 text-sm font-medium" />
          </FieldCell>
          <FieldCell label="Qty" error={isQuantityInvalid}>
            <Input 
              type="number" 
              value={item.quantity || ''} 
              onChange={e => onChange(index, 'quantity', parseWhole(e.target.value))} 
              className={cn("h-9 text-sm font-medium", isQuantityInvalid && "border-rose-500 focus-visible:ring-rose-500")} 
            />
          </FieldCell>
          <FieldCell label="Free">
            <Input 
              type="number" 
              value={item.freeQuantity === undefined || item.freeQuantity === null || isNaN(item.freeQuantity) ? '' : item.freeQuantity} 
              onChange={e => onChange(index, 'freeQuantity', parseWhole(e.target.value))} 
              className="h-9 text-sm font-medium" 
            />
          </FieldCell>
          <FieldCell label="GST %">
            <Input type="number" step="0.1" value={item.gstPercent ?? ''} onChange={e => onChange(index, 'gstPercent', parseDecimal(e.target.value))} className="h-9 text-sm font-medium" />
          </FieldCell>
          <FieldCell label="Amount">
            <div className="h-9 flex items-center text-sm font-bold text-emerald-600 tabular-nums">
              {formatCurrency(lineTotal)}
            </div>
          </FieldCell>
        </div>
      </CardContent>
    </Card>
  );
}

function FieldCell({ label, children, error }: { label: string; children: React.ReactNode; error?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className={cn(
        "text-[10px] md:text-xs uppercase tracking-widest font-black leading-none",
        error ? "text-rose-500 font-bold" : "text-muted-foreground"
      )}>{label}</Label>
      {children}
    </div>
  );
}
