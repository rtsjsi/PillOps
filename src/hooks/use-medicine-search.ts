'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchGlobalMedicines } from '@/lib/queries';

interface MedicineSearchResult {
  id: string;
  name: string;
  genericName: string;
  category: string;
  gstPercent: number;
  batches: {
    id: string;
    batchNumber: string;
    quantity: number;
    purchasePrice: number;
    mrp: number;
    expiryDate: string;
  }[];
}

interface UseMedicineSearchOptions {
  /** Medicines data to search through (pre-fetched) */
  medicines: any[];
  /** Debounce delay in ms. Default: 150 */
  debounceMs?: number;
  /** Max results to return. Default: 8 */
  maxResults?: number;
}

/**
 * Hook for fast, client-side medicine name typeahead search.
 * Works against pre-fetched medicines data for instant results.
 */
export function useMedicineSearch({
  medicines,
  debounceMs = 150,
  maxResults = 8,
}: UseMedicineSearchOptions) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MedicineSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      const q = searchQuery.toLowerCase();
      // 1. Search local medicines
      const localMatches = medicines
        .filter(
          (m) =>
            m.name?.toLowerCase().includes(q) ||
            m.genericName?.toLowerCase().includes(q)
        )
        .slice(0, maxResults);
        
      // Show local matches instantly
      setResults(localMatches);
      setSelectedIndex(-1);
      setIsOpen(localMatches.length > 0);

      // 2. Fetch global medicines (only if we need more results or always to enrich)
      try {
         const globalMatches = await fetchGlobalMedicines(searchQuery);
         // Filter out ones we already have locally to avoid duplicates
         const newGlobals = globalMatches.filter(g => !localMatches.some(l => l.name?.toLowerCase() === g.name?.toLowerCase()));
         
         if (newGlobals.length > 0) {
            setResults(prev => {
               const combined = [...prev, ...newGlobals].slice(0, maxResults * 2);
               setIsOpen(combined.length > 0);
               return combined;
            });
         }
      } catch (err) {
         console.error('Failed to fetch global medicines', err);
      }
    },
    [medicines, maxResults]
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => search(value), debounceMs);
    },
    [search, debounceMs]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            return results[selectedIndex];
          }
          // If no selection, return first result
          if (results.length > 0) {
            return results[0];
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setQuery('');
          break;
      }
      return null;
    },
    [isOpen, results, selectedIndex]
  );

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    setIsOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    query,
    setQuery: handleQueryChange,
    results,
    selectedIndex,
    isOpen,
    setIsOpen,
    handleKeyDown,
    clear,
  };
}
