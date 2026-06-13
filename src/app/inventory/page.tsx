'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchMedicines, fetchStoreSettings } from '@/lib/queries';
import { SearchBar } from '@/components/ui/searchBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fuzzyMatch, getTotalStock, getStockStatus, cn, getDaysUntilExpiry, getExpiryStatus } from '@/lib/utils';
import { PackageSearch, Filter, AlertTriangle, Clock, ShieldCheck, XCircle, FileScan, Download, FileSpreadsheet, FilePieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TableLoading from '@/components/ui/tableLoading';
import { FAB } from '@/components/ui/fab';
import { csvExport } from '@/lib/export';
import dynamic from 'next/dynamic';

const InventoryPDFButton = dynamic(
  () => import('@/components/inventory/pdf-button').then((mod) => mod.InventoryPDFButton),
  { ssr: false }
);
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Inventory() {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [storeName, setStoreName] = useState('My Pharmacy');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expiryFilter, setExpiryFilter] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [data, settings] = await Promise.all([
          fetchMedicines(),
          fetchStoreSettings()
        ]);
        setMedicines(data);
        if (settings?.name) setStoreName(settings.name);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const medicinesWithStatus = useMemo(() => {
    return medicines.map(med => {
      const batchesWithStatus = med.batches.map((batch: any) => {
        const days = getDaysUntilExpiry(batch.expiryDate);
        return { ...batch, daysUntilExpiry: days, expiryStatus: getExpiryStatus(days) };
      });

      const overallExpiryStatus = batchesWithStatus.reduce((worst: string, b: any) => {
        const priority = { expired: 3, critical: 2, warning: 1, ok: 0 };
        if (priority[b.expiryStatus as keyof typeof priority] > priority[worst as keyof typeof priority]) {
          return b.expiryStatus;
        }
        return worst;
      }, 'ok');

      return { ...med, batches: batchesWithStatus, overallExpiryStatus };
    });
  }, [medicines]);

  const stats = useMemo(() => {
    let expired = 0, critical = 0, warning = 0;
    medicinesWithStatus.forEach(med => {
      if (med.overallExpiryStatus === 'expired') expired++;
      else if (med.overallExpiryStatus === 'critical') critical++;
      else if (med.overallExpiryStatus === 'warning') warning++;
    });
    return { expired, critical, warning };
  }, [medicinesWithStatus]);

  const filteredMedicines = useMemo(() => {
    return medicinesWithStatus.filter(med => {
      const matchesSearch = fuzzyMatch(searchQuery, med.name) || fuzzyMatch(searchQuery, med.genericName);
      const matchesCategory = selectedCategory === 'All' || med.category === selectedCategory;
      const matchesExpiry = !expiryFilter || med.overallExpiryStatus === expiryFilter;
      return matchesSearch && matchesCategory && matchesExpiry;
    });
  }, [medicinesWithStatus, searchQuery, selectedCategory, expiryFilter]);

  if (loading) return <TableLoading />;

  const categories = ['All', ...Array.from(new Set(medicines.map(m => m.category)))];

  return (
    <div className="container py-8 flex flex-col gap-6 pb-24">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">Monitor and manage your medicine stock levels.</p>
      </header>

      {/* Expiry Alerts Banner */}
      <div className="-mx-4 px-4 py-2 border-b border-border mb-2 bg-background">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
          <button 
            onClick={() => setExpiryFilter(expiryFilter === 'expired' ? null : 'expired')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all shrink-0 font-bold text-sm",
              expiryFilter === 'expired' ? "bg-red-500 text-white border-red-600 shadow-lg shadow-red-500/20" : "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20"
            )}
          >
            <XCircle size={16} />
            {stats.expired} Expired
          </button>
          <button 
            onClick={() => setExpiryFilter(expiryFilter === 'critical' ? null : 'critical')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all shrink-0 font-bold text-sm",
              expiryFilter === 'critical' ? "bg-orange-500 text-white border-orange-600 shadow-lg shadow-orange-500/20" : "bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20"
            )}
          >
            <AlertTriangle size={16} />
            {stats.critical} Critical (7d)
          </button>
          <button 
            onClick={() => setExpiryFilter(expiryFilter === 'warning' ? null : 'warning')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all shrink-0 font-bold text-sm",
              expiryFilter === 'warning' ? "bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"
            )}
          >
            <Clock size={16} />
            {stats.warning} Warning (30d)
          </button>
          <button 
            onClick={() => setExpiryFilter(null)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all shrink-0 font-bold text-sm",
              !expiryFilter ? "bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
            )}
          >
            <ShieldCheck size={16} />
            All Safe
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBar 
            autoFocus
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            onClear={() => setSearchQuery('')}
            placeholder="Search medicines..."
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button variant="outline" size="icon" className="h-11 w-11 shrink-0">
               <Download size={18} />
            </Button>
          } />
          <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl">
             <DropdownMenuItem 
               onClick={() => csvExport(filteredMedicines.map(m => ({
                 name: m.name,
                 generic: m.genericName,
                 category: m.category,
                 stock: getTotalStock(m.batches),
                 status: m.overallExpiryStatus
               })), 'inventory_report')}
               className="flex items-center gap-2 font-bold p-3 rounded-xl cursor-pointer"
             >
                <FileSpreadsheet size={16} />
                Export CSV
             </DropdownMenuItem>
             
             <InventoryPDFButton 
                data={filteredMedicines.map(m => ({ ...m, totalQty: getTotalStock(m.batches) }))} 
                storeName={storeName} 
             />
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0">
           <Filter size={18} />
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
         {categories.map(cat => (
            <Button 
               key={cat}
               variant={selectedCategory === cat ? 'default' : 'outline'}
               size="sm"
               className="rounded-full whitespace-nowrap px-6"
               onClick={() => setSelectedCategory(cat)}
            >
               {cat}
            </Button>
         ))}
      </div>

      <div className="flex flex-col gap-4">
         {filteredMedicines.length === 0 ? (
            <Card className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground bg-muted/20 border-dashed">
               <PackageSearch size={48} className="opacity-20" />
               <p>No medicines found matching your criteria.</p>
            </Card>
         ) : (
            filteredMedicines.map(med => {
               const totalQty = getTotalStock(med.batches);
               const stockStatus = getStockStatus(totalQty, med.reorderLevel);
               const expiryStatus = med.overallExpiryStatus;
               
               return (
                 <Card key={med.id} className={cn(
                   "hover:shadow-md transition-shadow relative overflow-hidden",
                   expiryStatus === 'expired' && "border-red-500/50 bg-red-500/5"
                 )}>
                    {expiryStatus === 'expired' && (
                      <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest shadow-lg">
                        Expired
                      </div>
                    )}

                    <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4">
                       <div className="grid gap-1">
                         <CardTitle className="text-lg font-bold">{med.name}</CardTitle>
                         <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{med.genericName}</p>
                       </div>
                       <Badge variant={stockStatus === 'ok' ? 'default' : stockStatus === 'low' ? 'outline' : 'destructive'} className={cn(
                         stockStatus === 'ok' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20",
                         stockStatus === 'low' && "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"
                       )}>
                          {totalQty} in stock
                       </Badge>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                     <div className="flex flex-col gap-3">
                       <div className="flex flex-wrap gap-2">
                         {med.batches.map((batch: any, i: number) => (
                           <div key={i} className={cn(
                             "text-[10px] px-2 py-1 rounded-md font-bold border",
                             batch.expiryStatus === 'expired' ? "bg-red-500/10 text-red-600 border-red-500/20" :
                             batch.expiryStatus === 'critical' ? "bg-orange-500/10 text-orange-600 border-orange-600/20" :
                             batch.expiryStatus === 'warning' ? "bg-amber-500/10 text-amber-600 border-amber-600/20" :
                             "bg-muted text-muted-foreground border-border"
                           )}>
                             {batch.batchNumber} ({batch.expiryDate})
                           </div>
                         ))}
                       </div>

                       <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground pt-4 border-t border-border/50">
                          <div className="flex items-center gap-2">
                            <span className="bg-muted px-2 py-0.5 rounded">Rack: {med.rack}</span>
                          </div>
                          <div className="flex items-center gap-1">
                             {expiryStatus === 'expired' ? <XCircle size={14} className="text-red-500" /> :
                              expiryStatus === 'critical' ? <AlertTriangle size={14} className="text-orange-500" /> :
                              expiryStatus === 'warning' ? <Clock size={14} className="text-amber-500" /> :
                              <ShieldCheck size={14} className="text-emerald-500" />}
                             <span className={cn(
                               "uppercase tracking-widest text-[10px]",
                               expiryStatus === 'expired' && "text-red-500",
                               expiryStatus === 'critical' && "text-orange-500",
                               expiryStatus === 'warning' && "text-amber-500",
                               expiryStatus === 'ok' && "text-emerald-500"
                             )}>
                               {expiryStatus === 'ok' ? 'Safe' : expiryStatus}
                             </span>
                          </div>
                       </div>
                     </div>
                    </CardContent>
                 </Card>
               );
            })
         )}
      </div>
      <FAB href="/purchases/scan" icon={<FileScan size={32} />} label="Add Stock" />
    </div>
  );
}
