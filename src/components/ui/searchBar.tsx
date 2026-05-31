'use client';

import { Search, X } from 'lucide-react';
import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  function SearchBar({ value, onChange, onClear, placeholder = 'Search...', className = '', ...props }, ref) {
    return (
      <div className={cn('relative flex items-center w-full', className)}>
        <Search
          size={18}
          className="absolute left-3 text-muted-foreground pointer-events-none"
        />

        <input
          ref={ref}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            'w-full py-3 pl-10 pr-9',
            'rounded-lg border border-border',
            'bg-muted/30 text-foreground placeholder:text-muted-foreground',
            'text-sm font-medium',
            'outline-none transition-all duration-200',
            'focus:border-primary/40 focus:ring-2 focus:ring-primary/10 focus:bg-background',
            'shadow-inner shadow-black/[0.02]'
          )}
          {...props}
        />

        {value && onClear && (
          <button
            onClick={onClear}
            className="absolute right-3 p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
            aria-label="Clear search"
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  }
);
