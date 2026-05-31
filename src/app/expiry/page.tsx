'use client';

import { useEffect, useState } from 'react';
import { disposeBatch } from '@/app/actions';
import { fetchMedicines } from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDaysUntilExpiry, getExpiryStatus, formatExpiryDate, formatCurrency, cn } from '@/lib/utils';
import { Clock, AlertTriangle, Trash2, RotateCcw, TrendingDown, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TableLoading from '@/components/ui/tableLoading';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

export default function ExpiryTracker() {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const data = await fetchMedicines();
      setMedicines(data);
    } catch (error) {
      console.error('Failed to fetch expiry data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'return' | 'dispose'>('dispose');
  const [batchToProcess, setBatchToProcess] = useState<string | 'bulk' | null>(null);

  const requestAction = (action: 'return' | 'dispose', target: string | 'bulk') => {
    setDialogAction(action);
    setBatchToProcess(target);
    setDialogOpen(true);
  };

  const confirmAction = async () => {
    setDialogOpen(false);
    const ids = batchToProcess === 'bulk' ? Array.from(selectedBatches) : [batchToProcess as string];
    try {
      for (const id of ids) {
        await disposeBatch(id);
      }
      toast.success(dialogAction === 'return' ? 'Stock returned successfully.' : 'Stock disposed successfully.');
      if (batchToProcess === 'bulk') setSelectedBatches(new Set());
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process batch.');
    }
  };

  const toggleBatch = (id: string) => {
    const next = new Set(selectedBatches);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBatches(next);
  };

  const selectAll = () => {
    if (selectedBatches.size === items.length) {
      setSelectedBatches(new Set());
    } else {
      setSelectedBatches(new Set(items.map(i => i.batch.id)));
    }
  };

  if (loading) return <TableLoading />;

  interface ExpiryDisplayItem {
     medicine: any;
     batch: any;
     daysLeft: number;
     urgency: string;
     valueAtRisk: number;
  }

  const items: ExpiryDisplayItem[] = [];
  medicines.forEach(med => {
     med.batches.forEach((batch: any) => {
        if (batch.quantity === 0) return;
        const daysLeft = getDaysUntilExpiry(batch.expiryDate);
        if (daysLeft <= 180) { 
           items.push({
              medicine: med,
              batch: batch,
              daysLeft,
              urgency: getExpiryStatus(daysLeft),
              valueAtRisk: batch.quantity * (batch.purchasePrice || 0)
           });
        }
     });
  });

  items.sort((a, b) => a.daysLeft - b.daysLeft);
  const totalValueAtRisk = items.reduce((sum, item) => sum + item.valueAtRisk, 0);

  return (
    <div className="container py-8 flex flex-col gap-6 pb-24">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Expiry Radar</h1>
        <p className="text-muted-foreground font-medium">Predict and prevent losses from expiring stock.</p>
      </header>

      <Card className="bg-primary/5 border-primary/20 shadow-xl shadow-primary/5">
         <CardContent className="p-6 flex items-center gap-6">
            <div className="bg-primary text-white p-5 rounded-2xl shadow-lg shadow-primary/20">
               <TrendingDown size={32} />
            </div>
            <div>
               <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Value at Risk</p>
               <h3 className="text-3xl font-extrabold tracking-tight">{formatCurrency(totalValueAtRisk)}</h3>
               <p className="text-xs font-bold text-red-500 flex items-center gap-1 mt-1">
                 <AlertTriangle size={12} />
                 {items.length} batches requiring attention
               </p>
            </div>
         </CardContent>
      </Card>

      <div className="flex justify-between items-center my-2">
         <h2 className="text-xl font-bold tracking-tight">Expiring Batches ({items.length})</h2>
         {selectedBatches.size > 0 && (
           <div className="flex gap-2">
             <Button variant="outline" size="sm" className="font-bold text-primary border-primary/20 bg-primary/5" onClick={() => requestAction('return', 'bulk')}>
               <RotateCcw size={16} className="mr-2" /> Return Selected ({selectedBatches.size})
             </Button>
             <Button variant="outline" size="sm" className="font-bold text-red-500 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-600" onClick={() => requestAction('dispose', 'bulk')}>
               <Trash2 size={16} className="mr-2" /> Dispose Selected ({selectedBatches.size})
             </Button>
           </div>
         )}
      </div>

      <div className="flex items-center gap-2 px-1 mb-2">
         <input type="checkbox" className="w-5 h-5 accent-primary cursor-pointer" checked={items.length > 0 && selectedBatches.size === items.length} onChange={selectAll} />
         <span className="text-sm font-bold text-muted-foreground cursor-pointer" onClick={selectAll}>Select All</span>
      </div>

      <div className="flex flex-col gap-4">
         {items.map(item => {
            const urgency = item.urgency;
            const isSelected = selectedBatches.has(item.batch.id);
            
            return (
               <Card key={item.batch.id} className={cn(
                 "border-l-4 transition-all hover:shadow-md relative overflow-hidden",
                 isSelected && "ring-2 ring-primary border-transparent",
                 urgency === 'expired' ? "border-l-red-600 bg-red-500/5" : 
                 urgency === 'critical' ? "border-l-orange-500 bg-orange-500/5" : 
                 urgency === 'warning' ? "border-l-amber-500 bg-amber-500/5" : 
                 "border-l-emerald-500"
               )}>
                  {urgency === 'expired' && (
                    <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest shadow-lg">
                      Loss
                    </div>
                  )}

                  <CardHeader className="p-4 flex flex-row items-center gap-4 space-y-0">
                     <input type="checkbox" className="w-5 h-5 accent-primary shrink-0 cursor-pointer" checked={isSelected} onChange={() => toggleBatch(item.batch.id)} />
                     <div className="flex-1 grid gap-1">
                        <CardTitle className="text-lg font-bold cursor-pointer" onClick={() => toggleBatch(item.batch.id)}>{item.medicine.name}</CardTitle>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Store Section: {item.medicine.rack || 'Main'}</p>
                     </div>
                     <Badge variant={urgency === 'expired' || urgency === 'critical' ? 'destructive' : 'outline'} className={cn(
                        urgency === 'warning' && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                        urgency === 'ok' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                     )}>
                        {item.daysLeft <= 0 ? 'Expired' : `${item.daysLeft} days left`}
                     </Badge>
                  </CardHeader>
                  
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm font-medium mb-4">
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Batch Number</span>
                         <span className="font-bold">{item.batch.batchNumber}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Expiry Date</span>
                         <span className="font-bold">{formatExpiryDate(item.batch.expiryDate)}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Stock Quantity</span>
                         <span className="font-bold">{item.batch.quantity} Units</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Est. Loss Value</span>
                         <span className="text-red-500 font-bold">{formatCurrency(item.valueAtRisk)}</span>
                       </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-border">
                       <Button variant="outline" size="sm" className="flex-1 font-bold h-11 rounded-xl" onClick={() => requestAction('return', item.batch.id)}>
                         <RotateCcw size={14} className="mr-2" />
                         Return to Vendor
                       </Button>
                       <Button variant="outline" size="sm" className="flex-1 font-bold h-11 rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-600 border-red-100" onClick={() => requestAction('dispose', item.batch.id)}>
                         <Trash2 size={14} className="mr-2" />
                         Dispose Stock
                       </Button>
                    </div>
                  </CardContent>
               </Card>
            );
          })}
          {items.length === 0 && (
            <Card className="p-16 text-center text-muted-foreground bg-muted/20 border-dashed border-2 flex flex-col items-center gap-4 rounded-[2rem]">
              <Clock size={48} className="opacity-20" />
              <p className="font-bold">No batches expiring within 180 days. Your stock is healthy!</p>
            </Card>
          )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogAction === 'return' ? 'Return Stock' : 'Dispose Stock'}</DialogTitle>
            <DialogDescription>
              {dialogAction === 'return' 
                ? 'Are you sure you want to return the selected stock to the vendor? This will reduce the quantity to 0.'
                : 'Are you sure you want to dispose of the selected stock? This will reduce the quantity to 0.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant={dialogAction === 'return' ? 'default' : 'destructive'} onClick={confirmAction}>
              Confirm {dialogAction === 'return' ? 'Return' : 'Dispose'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
