'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Globe } from 'lucide-react';
import { useMedicineSearch } from '@/hooks/use-medicine-search';
import { useClickOutside } from '@/hooks/use-anchored-portal';
import { AnchoredListbox } from '@/components/ui/anchored-listbox';
import { cn } from '@/lib/utils';

interface MedicineAutocompleteProps {
  /** Current value (medicine name string) */
  value: string;
  /** Called when user types or selects. fullItem is the complete medicine object if selected from dropdown. */
  onChange: (val: string, fullItem?: any) => void;
  /** Pre-fetched store inventory medicines for instant local search */
  medicines: any[];
  /** Input placeholder */
  placeholder?: string;
  /** Additional className for the input */
  className?: string;
  /** Whether the input is required */
  required?: boolean;
  /** Auto-focus the input on mount */
  autoFocus?: boolean;
  /** Ref forwarded to the input element */
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * Unified medicine typeahead autocomplete used across the entire app.
 * 
 * Features:
 * - Instant client-side search against pre-fetched store inventory
 * - Async fuzzy search against global_medicine_master via RPC
 * - Visual distinction between local inventory and global master matches
 * - Rich dropdown showing category, manufacturer, GST, and stock info
 * - Keyboard navigation (↑↓ Enter Escape)
 * - Debounced input with 150ms delay
 */
export function MedicineAutocomplete({ 
  value, 
  onChange, 
  medicines,
  placeholder,
  className,
  required,
  autoFocus,
  inputRef,
}: MedicineAutocompleteProps) {
  const { query, setQuery, results, isOpen, setIsOpen, isLoading, selectedIndex, handleKeyDown } = useMedicineSearch({ medicines });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync external value into the search query (e.g. when parent sets it)
  useEffect(() => {
    if (value && value !== query) {
      setQuery(value, true);
    }
  }, [value]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Close on outside click (include portaled list)
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);
  useClickOutside([wrapperRef, listRef], close, isOpen);

  const handleSelect = (item: any) => {
    onChange(item.name, item);
    setQuery(item.name, true);
    setIsOpen(false);
  };

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <Input 
        ref={inputRef}
        required={required}
        autoFocus={autoFocus}
       
        value={query} 
        onChange={e => {
          setQuery(e.target.value);
          onChange(e.target.value, null);
          setIsOpen(true);
        }} 
        onFocus={() => {
          if (query) setIsOpen(true);
        }}
        onKeyDown={(e) => {
          const result = handleKeyDown(e);
          if (result && typeof result !== 'boolean') {
            handleSelect(result);
          }
        }}
        className={cn(
          "font-bold border-none bg-slate-50 shadow-inner h-10 text-base md:text-sm w-full",
          className
        )}
        autoComplete="off"
      />

      {/* Dropdown — portaled so Card overflow-hidden cannot clip it */}
      <AnchoredListbox
        anchorRef={wrapperRef}
        isOpen={isOpen && (results.length > 0 || isLoading)}
        listRef={listRef}
        className="max-h-72"
      >
          {results.map((r, i) => {
            const isLocal = r._source === 'local';
            const hasStock = r.totalStock !== undefined && r.totalStock > 0;
            const mrp = r.batches?.[0]?.mrp;
            
            return (
              <div 
                key={r.id || `${r.name}-${i}`}
                className={cn(
                  "group px-3 py-2.5 cursor-pointer transition-colors border-b border-border/50 last:border-0",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedIndex === i ? "bg-accent text-accent-foreground" : "text-popover-foreground"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(r)}
              >
                {/* Row 1: Name + badges */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-sm truncate">{r.name}</span>
                  {r.category && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 uppercase shrink-0 font-semibold">
                      {r.category}
                    </Badge>
                  )}
                  {isLocal && hasStock && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0 font-semibold text-emerald-600 border-emerald-200 bg-emerald-50">
                      {r.totalStock} in stock
                    </Badge>
                  )}
                </div>

                {/* Row 2: Details */}
                <div className={cn(
                  "flex items-center gap-3 mt-0.5 text-[11px] font-medium transition-colors",
                  selectedIndex === i ? "text-accent-foreground/80" : "text-muted-foreground",
                  "group-hover:text-accent-foreground/80"
                )}>
                  {r.genericName && (
                    <span className="truncate max-w-[180px]">{r.genericName}</span>
                  )}
                  {r.manufacturer && (
                    <span className="truncate max-w-[120px]">• {r.manufacturer}</span>
                  )}
                  {mrp !== undefined && (
                    <span className="shrink-0">• MRP ₹{mrp}</span>
                  )}
                  {!isLocal && (
                    <span className="ml-auto shrink-0 flex items-center gap-0.5 text-blue-500">
                      <Globe className="w-3 h-3" />
                      Global
                    </span>
                  )}
                  {isLocal && (
                    <span className="ml-auto shrink-0 flex items-center gap-0.5 text-emerald-500">
                      <Package className="w-3 h-3" />
                      Store
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className={cn(
              "px-3 py-2.5 flex items-center justify-center gap-2 text-muted-foreground text-xs font-medium",
              results.length > 0 && "border-t border-border/50 bg-slate-50/50 dark:bg-slate-800/50"
            )}>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Searching global master...</span>
            </div>
          )}
      </AnchoredListbox>
    </div>
  );
}
