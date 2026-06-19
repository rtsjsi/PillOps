'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MedicineAutocomplete } from '@/components/purchases/medicine-autocomplete';
import { Trash2, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { StoreInventoryBatch } from '@/lib/types';

export interface SalesItem {
  medicineId: string;
  medicineName: string;
  storeInventoryBatchId: string;
  batchNumber: string;
  expiryDate: string;
  mrp: number;
  quantity: number;
  gstPercent: number;
  totalAmount: number;
}

interface SalesItemCardProps {
  item: SalesItem;
  index: number;
  onChange: (idx: number, field: keyof SalesItem, value: any, fullItem?: any) => void;
  onRemove: (idx: number) => void;
  medicines: any[];
  canRemove?: boolean;
}

export function SalesItemCard({
  item,
  index,
  onChange,
  onRemove,
  medicines,
  canRemove = true,
}: SalesItemCardProps) {
  const needsAttention = !item.medicineName || !item.storeInventoryBatchId;

  // Find the selected medicine to get its batches
  const selectedMedicine = medicines.find(m => m.id === item.medicineId || m.name === item.medicineName);
  const availableBatches: StoreInventoryBatch[] = selectedMedicine?.batches?.filter((b: StoreInventoryBatch) => b.quantity > 0) || [];
  
  // Find current batch to show max quantity
  const currentBatch = availableBatches.find(b => b.id === item.storeInventoryBatchId);

  const handleBatchSelect = (batchId: string | null) => {
    if (!batchId) return;
    const batch = availableBatches.find(b => b.id === batchId);
    if (batch) {
      onChange(index, 'storeInventoryBatchId', batch.id);
      onChange(index, 'batchNumber', batch.batchNumber);
      onChange(index, 'expiryDate', batch.expiryDate);
      onChange(index, 'mrp', batch.mrp);
      
      // Auto adjust quantity if current quantity exceeds batch available
      if (item.quantity > batch.quantity) {
        onChange(index, 'quantity', batch.quantity);
      }
    }
  };

  return (
    <Card className={cn(
      "transition-all border-l-4 shadow-sm hover:shadow-md",
      needsAttention ? "border-l-amber-400 bg-amber-50/20 dark:bg-amber-950/10" : "border-l-slate-200 dark:border-l-slate-700"
    )}>
      {/* ─── Item Header ─── */}
      <CardHeader className="p-3 pb-0 flex flex-row items-center gap-2 space-y-0">
        <span className={cn(
          "text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shrink-0",
          needsAttention ? "bg-amber-400" : "bg-slate-500"
        )}>
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          {needsAttention && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 mb-1">
              <AlertTriangle size={10} />
              <span>{(!item.medicineName) ? "Select medicine" : "Select batch"}</span>
            </div>
          )}
          <MedicineAutocomplete
            required
            value={item.medicineName}
            onChange={(val, fullItem) => onChange(index, 'medicineName', val, fullItem)}
            medicines={medicines}
            placeholder="Search medicine..."
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-2 gap-y-2.5">
          
          <FieldCell label="Batch">
            <Select value={item.storeInventoryBatchId || ''} onValueChange={handleBatchSelect}>
              <SelectTrigger className="h-9 text-sm font-medium">
                <SelectValue placeholder="Select Batch" />
              </SelectTrigger>
              <SelectContent>
                {availableBatches.length > 0 ? (
                  availableBatches.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batchNumber} (Stock: {b.quantity})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    {item.medicineName ? "Out of Stock" : "Select medicine first"}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </FieldCell>

          <FieldCell label="Exp">
            <Input readOnly value={item.expiryDate || ''} className="h-9 text-sm font-medium bg-muted/50" />
          </FieldCell>

          <FieldCell label="MRP (₹)">
            <Input readOnly value={item.mrp || ''} className="h-9 text-sm font-medium bg-muted/50" />
          </FieldCell>

          <FieldCell label="GST %">
            <Input type="number" step="0.1" value={item.gstPercent ?? ''} onChange={e => onChange(index, 'gstPercent', parseFloat(e.target.value))} className="h-9 text-sm font-medium" />
          </FieldCell>

          <FieldCell label="Qty">
            <div className="relative">
              <Input 
                type="number" 
                value={item.quantity || ''} 
                onChange={e => onChange(index, 'quantity', parseInt(e.target.value))} 
                className={cn("h-9 text-sm font-medium", currentBatch && item.quantity > currentBatch.quantity && "border-rose-500")}
                max={currentBatch?.quantity || 1}
                min={1}
              />
              {currentBatch && (
                <span className="absolute -top-5 right-0 text-[9px] font-bold text-muted-foreground">
                  Max: {currentBatch.quantity}
                </span>
              )}
            </div>
          </FieldCell>

          <FieldCell label="Total (₹)">
            <Input readOnly value={item.totalAmount ? item.totalAmount.toFixed(2) : ''} className="h-9 text-sm font-black text-emerald-600 bg-muted/50" />
          </FieldCell>

        </div>
      </CardContent>
    </Card>
  );
}

function FieldCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 relative">
      <Label className="text-[10px] md:text-xs uppercase tracking-widest font-black text-muted-foreground leading-none">{label}</Label>
      {children}
    </div>
  );
}
