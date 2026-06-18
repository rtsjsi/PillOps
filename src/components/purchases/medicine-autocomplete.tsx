'use client';

import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useMedicineSearch } from '@/hooks/use-medicine-search';
import { cn } from '@/lib/utils';

export function MedicineAutocomplete({ 
  value, 
  onChange, 
  medicines 
}: { 
  value: string; 
  onChange: (val: string, fullItem?: any) => void; 
  medicines: any[] 
}) {
  const { query, setQuery, results, isOpen, setIsOpen, isLoading, selectedIndex, handleKeyDown } = useMedicineSearch({ medicines });
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync initial value
  useEffect(() => {
    if (value && value !== query) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <Input 
        required 
        placeholder="Medicine Name" 
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
             onChange(result.name, result);
             setQuery(result.name);
             setIsOpen(false);
          }
        }}
        className="font-bold border-none bg-slate-50 shadow-inner h-12 text-lg w-full" 
      />
      {(isOpen && (results.length > 0 || isLoading)) && (
        <div className="absolute z-50 top-full left-0 w-full bg-white border shadow-xl rounded-xl mt-1 max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <div 
              key={r.id} 
              className={cn("px-4 py-3 cursor-pointer hover:bg-slate-50 border-b last:border-0", selectedIndex === i && "bg-slate-100")}
              onClick={() => {
                onChange(r.name, r);
                setQuery(r.name);
                setIsOpen(false);
              }}
            >
              <div className="font-bold">{r.name}</div>
              <div className="text-xs text-muted-foreground">{r.genericName}</div>
            </div>
          ))}
          {isLoading && (
             <div className={cn("px-4 py-3 flex items-center justify-center gap-2 text-muted-foreground text-sm", results.length > 0 && "border-t bg-slate-50/50")}>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Searching global master...</span>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
