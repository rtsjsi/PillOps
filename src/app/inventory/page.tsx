'use client';

import { useEffect, useState, useMemo } from 'react';
import { getMedicines } from '@/app/actions';
import { SearchBar } from '@/components/ui/searchBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fuzzyMatch, getTotalStock, getStockStatus, cn } from '@/lib/utils';
import { PackageSearch, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TableLoading from '@/components/ui/tableLoading';

export default function Inventory() {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getMedicines();
        setMedicines(data);
      } catch (error) {
        console.error('Failed to fetch medicines:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredMedicines = useMemo(() => {
    return medicines.filter(med => {
      const matchesSearch = fuzzyMatch(searchQuery, med.name) || fuzzyMatch(searchQuery, med.genericName);
      const matchesCategory = selectedCategory === 'All' || med.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [medicines, searchQuery, selectedCategory]);

  if (loading) return <TableLoading />;

  const categories = ['All', ...Array.from(new Set(medicines.map(m => m.category)))];

  return (
    <div className="container py-8 flex flex-col gap-6 pb-24">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">Monitor and manage your medicine stock levels.</p>
      </header>

      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBar 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            onClear={() => setSearchQuery('')}
            placeholder="Search medicines..."
          />
        </div>
        <Button variant="outline" size="icon" className="h-11 w-11">
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
               const status = getStockStatus(totalQty, med.reorderLevel);
               
               return (
                 <Card key={med.id} className="hover:shadow-md transition-shadow">
                   <CardHeader className="flex flex-row items-start justify-between space-y-0 p-4">
                      <div className="grid gap-1">
                        <CardTitle className="text-lg font-bold">{med.name}</CardTitle>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{med.genericName}</p>
                      </div>
                      <Badge variant={status === 'ok' ? 'default' : status === 'low' ? 'outline' : 'destructive'} className={cn(
                        status === 'ok' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20",
                        status === 'low' && "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"
                      )}>
                         {totalQty} in stock
                      </Badge>
                   </CardHeader>
                   <CardContent className="p-4 pt-0">
                    <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground pt-4 border-t border-border">
                       <div className="flex items-center gap-2">
                         <span className="bg-muted px-2 py-0.5 rounded">Rack: {med.rack}</span>
                       </div>
                       <div>{med.batches.length} batch(es)</div>
                    </div>
                   </CardContent>
                 </Card>
               );
            })
         )}
      </div>
    </div>
  );
}


