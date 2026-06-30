'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Info, AlertTriangle, ShieldAlert, Wand2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { searchGlobalMedicines, enrichSingleMedicine } from './actions';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function MedicinesDirectoryPage() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const fetchMedicines = useCallback(async (q: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await searchGlobalMedicines(q);
      if (fetchError) throw new Error(fetchError);
      setMedicines(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch medicines');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicines(debouncedQuery);
  }, [debouncedQuery, fetchMedicines]);

  const handleEnrichSingle = async (med: any) => {
    setEnrichingId(med.id);
    setError(null);
    try {
      const res = await enrichSingleMedicine({
        id: med.id,
        name: med.name,
        manufacturer: med.manufacturer,
        category: med.category
      });
      if (!res.success) throw new Error(res.error || 'Failed to enrich medicine');
      alert(`Successfully enriched ${med.name}!`);
      fetchMedicines(debouncedQuery);
    } catch (err: any) {
      setError(err.message || 'Failed to enrich medicine');
    } finally {
      setEnrichingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Global Medicine Master</h1>
          <p className="text-muted-foreground">Search and view details of all available medicines in the directory.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50 rounded-t-xl" />
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && medicines.length === 0 && (
        <div className="text-center py-12 px-4 border border-dashed rounded-xl bg-muted/20">
          <Info className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No medicines found</h3>
          <p className="text-muted-foreground">Try adjusting your search query.</p>
        </div>
      )}

      {/* Results Grid */}
      {!isLoading && !error && medicines.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {medicines.map((med) => (
            <Card key={med.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1 pr-2">
                    <CardTitle className="text-base">{med.name}</CardTitle>
                    <CardDescription className="text-xs font-medium text-primary">
                      {med.genericName || 'No Generic Name'}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs px-2 shrink-0" 
                    onClick={() => handleEnrichSingle(med)}
                    disabled={enrichingId === med.id}
                  >
                    {enrichingId === med.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                    Enrich
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline" className="text-[10px]">{med.category}</Badge>
                  {med.schedule && med.schedule !== 'OTC' && (
                    <Badge variant="destructive" className="text-[10px]">Schedule {med.schedule}</Badge>
                  )}
                  {med.isNarcotic && (
                    <Badge variant="destructive" className="text-[10px] bg-red-600">NDPS / Narcotic</Badge>
                  )}
                  {med.prescriptionRequired && (
                    <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Rx Required
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-y-2">
                  <div className="text-muted-foreground text-xs">Manufacturer</div>
                  <div className="font-medium truncate" title={med.manufacturer}>{med.manufacturer || 'N/A'}</div>
                  
                  <div className="text-muted-foreground text-xs">Pack Size</div>
                  <div className="font-medium">{med.packSize} {med.uom}</div>
                  
                  <div className="text-muted-foreground text-xs">HSN Code</div>
                  <div className="font-medium">{med.hsnCode || 'N/A'}</div>
                  
                  <div className="text-muted-foreground text-xs">GST %</div>
                  <div className="font-medium">{med.gstPercent}%</div>
                </div>

                {med.storageConditions && (
                  <div className="pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">Storage</div>
                    <p className="text-xs font-medium">{med.storageConditions}</p>
                  </div>
                )}

                {med.ingredients && med.ingredients.length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <div className="text-xs text-muted-foreground mb-1">Active Ingredients</div>
                    <ul className="text-xs font-medium space-y-1">
                      {med.ingredients.map((ing: any, idx: number) => (
                        <li key={idx} className="flex justify-between">
                          <span className="truncate pr-2">{ing.salt}</span>
                          <span className="text-muted-foreground shrink-0">{ing.strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
    </div>
  );
}
