'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchGlobalMedicines } from '@/lib/queries';

interface MedicineSearchResult {
  id: string;
  name: string;
  genericName: string;
  category: string;
  gstPercent: number;
  reorderLevel: number;
  totalStock?: number;
  rack: string;
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
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

function getMatchScore(query: string, target: string) {
    if (!target) return 0;
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 60;
    
    const qWords = q.split(/[\s-]+/).filter(Boolean);
    if (qWords.length > 1 && qWords.every(w => t.includes(w))) return 55;
    
    const cleanQ = q.replace(/[^a-z0-9]/g, '');
    const cleanT = t.replace(/[^a-z0-9]/g, '');
    if (cleanT.includes(cleanQ)) return 50;

    if (Math.abs(cleanQ.length - cleanT.length) < 5 && cleanQ.length > 3) {
        const dist = levenshteinDistance(cleanQ, cleanT);
        if (dist <= 2) return 40 - dist; 
        if (cleanQ.length > 6 && dist <= 3) return 30 - dist;
    }
    return 0;
}

export function useMedicineSearch({
  medicines,
  debounceMs = 300,
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

      // 1. Search local medicines with smart scoring
      const scoredMatches = medicines
        .map(m => {
           const nameScore = getMatchScore(searchQuery, m.name);
           const genScore = getMatchScore(searchQuery, m.genericName);
           return { item: m, score: Math.max(nameScore, genScore) };
        })
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score);

      const localMatches = scoredMatches.map(m => m.item).slice(0, maxResults);
        
      // Show local matches instantly
      setResults(localMatches);
      setSelectedIndex(-1);
      setIsOpen(localMatches.length > 0);

      // 2. Fetch global medicines (only if we need more results or always to enrich)
      // Only fetch if query is at least 3 characters to save network/db load
      if (searchQuery.trim().length >= 3) {
         try {
            const globalMatches = await fetchGlobalMedicines(searchQuery);
            
            const scoredGlobals = globalMatches
               .map((m: any) => {
                  const nameScore = getMatchScore(searchQuery, m.name);
                  const genScore = getMatchScore(searchQuery, m.genericName);
                  return { item: m, score: Math.max(nameScore, genScore) };
               })
               .filter((m: any) => m.score > 0)
               .sort((a: any, b: any) => b.score - a.score);

            // Filter out ones we already have locally to avoid duplicates
            const newGlobals = scoredGlobals
               .map((m: any) => m.item)
               .filter((g: any) => !localMatches.some((l: any) => l.name?.toLowerCase() === g.name?.toLowerCase()));
            
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
