'use client';

import { useEffect, useState, useMemo } from 'react';
import { loadStore } from '@/lib/store';
import { StoreData, Medicine } from '@/lib/types';
import { SearchBar } from '@/components/ui/SearchBar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { fuzzyMatch, getTotalStock, getStockStatus } from '@/lib/utils';
import { PackageSearch, Filter } from 'lucide-react';

export default function Inventory() {
  const [store, setStore] = useState<StoreData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    setStore(loadStore());
  }, []);

  const filteredMedicines = useMemo(() => {
    if (!store) return [];
    return store.medicines.filter(med => {
      const matchesSearch = fuzzyMatch(med.name, searchQuery) || fuzzyMatch(med.genericName, searchQuery);
      const matchesCategory = selectedCategory === 'All' || med.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [store, searchQuery, selectedCategory]);

  if (!store) return <div className="flex-center" style={{ height: '100vh' }}>Loading...</div>;

  const categories = ['All', ...Array.from(new Set(store.medicines.map(m => m.category)))];

  return (
    <div style={{ padding: 'var(--space-4)', paddingBottom: '80px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <header>
        <h1 style={{ fontSize: '1.5rem' }}>Inventory</h1>
      </header>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <SearchBar 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          onClear={() => setSearchQuery('')}
          placeholder="Search medicines..."
        />
        <button className="btn btn-outline" style={{ padding: '0 12px' }}>
           <Filter size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
         {categories.map(cat => (
            <button 
               key={cat}
               className={selectedCategory === cat ? 'btn btn-primary' : 'btn btn-outline'}
               style={{ whiteSpace: 'nowrap', borderRadius: '100px', padding: '4px 16px', fontSize: '0.8rem' }}
               onClick={() => setSelectedCategory(cat)}
            >
               {cat}
            </button>
         ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
         {filteredMedicines.length === 0 ? (
            <div className="flex-center" style={{ flexDirection: 'column', gap: '16px', padding: '40px 0', opacity: 0.6 }}>
               <PackageSearch size={48} />
               <p>No medicines found.</p>
            </div>
         ) : (
            filteredMedicines.map(med => {
               const totalQty = getTotalStock(med.batches);
               const status = getStockStatus(totalQty, med.reorderLevel);
               
               return (
                 <Card key={med.id}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                     <div>
                       <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{med.name}</div>
                       <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{med.genericName}</div>
                     </div>
                     <Badge variant={status === 'in-stock' ? 'success' : status === 'low' ? 'warning' : 'danger'}>
                        {totalQty} in stock
                     </Badge>
                   </div>
                   
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(107, 114, 128, 0.1)' }}>
                      <div className="text-muted">Rack: {med.rack}</div>
                      <div className="text-muted">{med.batches.length} batch(es)</div>
                   </div>
                 </Card>
               );
            })
         )}
      </div>
    </div>
  );
}
