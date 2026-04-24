'use client';

import { useEffect, useState } from 'react';
import { getMedicines } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDaysUntilExpiry, getExpiryUrgency, formatExpiryDate, formatCurrency, cn } from '@/lib/utils';
import { Clock, AlertTriangle, Trash2, RotateCcw, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TableLoading from '@/components/ui/TableLoading';

export default function ExpiryTracker() {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getMedicines();
        setMedicines(data);
      } catch (error) {
        console.error('Failed to fetch expiry data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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
              urgency: getExpiryUrgency(daysLeft),
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

      <Card className="bg-primary/5 border-primary/20">
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

      <div className="flex flex-col gap-4">
         {items.map(item => {
            const urgency = item.urgency;
            
            return (
               <Card key={item.batch.id} className={cn(
                 "border-l-4 transition-all hover:shadow-md",
                 urgency === 'critical' ? "border-l-red-500" : urgency === 'warning' ? "border-l-amber-500" : "border-l-blue-500"
               )}>
                  <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                     <CardTitle className="text-lg font-bold">{item.medicine.name}</CardTitle>
                     <Badge variant={urgency === 'critical' ? 'destructive' : 'outline'} className={cn(
                       urgency === 'warning' && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                       urgency === 'safe' && "bg-blue-500/10 text-blue-600 border-blue-500/20"
                     )}>
                        {item.daysLeft <= 0 ? 'Expired' : `${item.daysLeft} days`}
                     </Badge>
                  </CardHeader>
                  
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm font-medium mb-4">
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Batch</span>
                         <span>{item.batch.batchNumber}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Expiry</span>
                         <span>{formatExpiryDate(item.batch.expiryDate)}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Quantity</span>
                         <span>{item.batch.quantity}</span>
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Loss Value</span>
                         <span className="text-red-500">{formatCurrency(item.valueAtRisk)}</span>
                       </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-border">
                       <Button variant="outline" size="sm" className="flex-1 font-bold">
                         <RotateCcw size={14} className="mr-2" />
                         Return
                       </Button>
                       <Button variant="outline" size="sm" className="flex-1 font-bold text-red-500 hover:bg-red-500/10 hover:text-red-600">
                         <Trash2 size={14} className="mr-2" />
                         Dispose
                       </Button>
                    </div>
                  </CardContent>
               </Card>
            );
         })}
         {items.length === 0 && (
           <Card className="p-16 text-center text-muted-foreground bg-muted/20 border-dashed border-2 flex flex-col items-center gap-4">
             <Clock size={48} className="opacity-20" />
             <p className="font-medium">No batches expiring within 180 days. Your stock is healthy!</p>
           </Card>
         )}
      </div>
    </div>
  );
}
