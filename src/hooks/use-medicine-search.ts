'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchGlobalMedicines } from '@/lib/queries';

interface UseMedicineSearchOptions {
  /** Medicines data to search through (pre-fetched store inventory) */
  medicines: any[];
  /** Debounce delay in ms. Default: 150 */
  debounceMs?: number;
  /** Max results to return. Default: 10 */
  maxResults?: number;
}

/**
 * Hook for fast medicine typeahead search.
 * 
 * Two-tier approach:
 * 1. Instant client-side search against pre-fetched store inventory
 * 2. Async server-side search against global_medicine_master via search_medicines RPC
 * 
 * Results are deduped and scored by relevance (exact > starts with > contains > fuzzy).
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

export function getMatchScore(query: string, target: string) {
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

export function expandMedicineAbbreviations(name: string): string {
  if (!name) return '';
  let expanded = name.toUpperCase();
  expanded = expanded.replace(/\bSYP\b/g, 'SYRUP');
  expanded = expanded.replace(/\bTAB\b/g, 'TABLET');
  expanded = expanded.replace(/\bCAP\b/g, 'CAPSULE');
  expanded = expanded.replace(/\bINJ\b/g, 'INJECTION');
  expanded = expanded.replace(/\bOINT\b/g, 'OINTMENT');
  expanded = expanded.replace(/\bSUSP\b/g, 'SUSPENSION');
  expanded = expanded.replace(/\bDRP\b/g, 'DROPS');
  expanded = expanded.replace(/\bCRM\b/g, 'CREAM');
  return expanded;
}

export function useMedicineSearch({
  medicines,
  debounceMs = 150,
  maxResults = 10,
}: UseMedicineSearchOptions) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      // Cancel any in-flight global search
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // 1. Instant client-side search against pre-fetched store inventory
      const scoredMatches = medicines
        .map(m => {
           const nameScore = getMatchScore(searchQuery, m.name);
           const genScore = getMatchScore(searchQuery, m.genericName);
           return { item: { ...m, _source: 'local' as const }, score: Math.max(nameScore, genScore) };
        })
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score);

      const localMatches = scoredMatches.map(m => m.item).slice(0, maxResults);
        
      // Show local matches instantly
      setResults(localMatches);
      setSelectedIndex(-1);
      setIsOpen(localMatches.length > 0);

      // 2. Async global search — start from 2 characters
      if (searchQuery.trim().length >= 2) {
         setIsLoading(true);
         try {
            const globalMatches = await fetchGlobalMedicines(searchQuery);
            
            // Check if this search is still relevant
            if (controller.signal.aborted) return;
            
            const scoredGlobals = globalMatches
               .map((m: any) => {
                  const nameScore = getMatchScore(searchQuery, m.name);
                  const genScore = getMatchScore(searchQuery, m.genericName);
                  return { item: { ...m, _source: 'global' as const }, score: Math.max(nameScore, genScore) };
               })
               .filter((m: any) => m.score > 0)
               .sort((a: any, b: any) => b.score - a.score);

            // Deduplicate: prefer local matches over global ones
            const localNames = new Set(localMatches.map(l => l.name?.toLowerCase()));
            const newGlobals = scoredGlobals
               .map((m: any) => m.item)
               .filter((g: any) => !localNames.has(g.name?.toLowerCase()));
            
            if (newGlobals.length > 0 || localMatches.length > 0) {
               const combined = [...localMatches, ...newGlobals].slice(0, maxResults);
               setResults(combined);
               setIsOpen(combined.length > 0);
            }
         } catch (err: any) {
            if (err?.name !== 'AbortError') {
               console.error('Failed to fetch global medicines', err);
            }
         } finally {
            if (!controller.signal.aborted) {
               setIsLoading(false);
            }
         }
      }
    },
    [medicines, maxResults]
  );

  const handleQueryChange = useCallback(
    (value: string, skipSearch = false) => {
      setQuery(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!skipSearch) {
        timerRef.current = setTimeout(() => search(value), debounceMs);
      }
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
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return {
    query,
    setQuery: handleQueryChange,
    results,
    selectedIndex,
    isOpen,
    setIsOpen,
    isLoading,
    handleKeyDown,
    clear,
  };
}
