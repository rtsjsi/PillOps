import { getPurchases } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileScan, Box, History } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function Purchases() {
  const purchases = await getPurchases();

  return (
    <div className="container py-8 flex flex-col gap-8 pb-24">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
      </header>

      {/* Hero Action */}
      <Card className="flex flex-col items-center gap-6 p-8 bg-gradient-to-br from-primary/10 to-transparent border-primary/20 shadow-xl shadow-primary/5">
         <div className="bg-primary text-white p-5 rounded-3xl shadow-lg shadow-primary/30 ring-8 ring-primary/5 animate-pulse">
            <FileScan size={36} />
         </div>
         <div className="text-center max-w-sm">
            <h2 className="text-2xl font-extrabold mb-1 tracking-tight">AI Invoice Scanner</h2>
            <p className="text-muted-foreground text-sm font-medium mb-6 leading-relaxed">Instantly digitize distributor bills and update your inventory automatically.</p>
            <Button asChild size="lg" className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg shadow-primary/20">
              <Link href="/purchases/scan">
                Scan New Invoice
              </Link>
            </Button>
         </div>
      </Card>

      <section>
         <div className="flex items-center gap-2 mb-4">
           <History size={20} className="text-muted-foreground" />
           <h2 className="text-xl font-bold tracking-tight">Recent Inwards</h2>
         </div>
         <div className="flex flex-col gap-4">
            {purchases.length === 0 ? (
               <Card className="flex flex-col items-center justify-center gap-4 p-12 text-muted-foreground bg-muted/10 border-dashed border-2">
                  <Box size={48} className="opacity-20" />
                  <p className="font-medium text-sm">No purchase records yet.</p>
               </Card>
            ) : (
               purchases.map((inv: any) => (
                  <Card key={inv.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                         <div className="font-bold text-lg leading-tight">{inv.distributorName}</div>
                         <div className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatCurrency(inv.total)}</div>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2 border-t border-border/50">
                         <div className="bg-muted px-2 py-0.5 rounded"># {inv.invoiceNumber}</div>
                         <div>{formatDate(inv.invoiceDate)}</div>
                      </div>
                    </CardContent>
                  </Card>
               ))
            )}
         </div>
      </section>
    </div>
  );
}


