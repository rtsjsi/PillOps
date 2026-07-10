'use client';

import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { AnchoredListbox } from '@/components/ui/anchored-listbox';
import { useClickOutside } from '@/hooks/use-anchored-portal';
import { cn } from '@/lib/utils';

interface GenericAutocompleteProps extends React.InputHTMLAttributes<HTMLInputElement> {
  options: string[];
  value: string;
  onValueChange: (val: string) => void;
}

export function GenericAutocomplete({ options, value, onValueChange, className, ...props }: GenericAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options
    .filter(o => o.toLowerCase().includes((value || '').toLowerCase()))
    .filter(o => o !== value)
    .slice(0, 5);

  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside([wrapperRef, listRef], close, isOpen);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredOptions.length === 0) {
      if (props.onKeyDown) props.onKeyDown(e);
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
          onValueChange(filteredOptions[selectedIndex]);
          setIsOpen(false);
        } else if (filteredOptions.length > 0) {
          onValueChange(filteredOptions[0]);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      default:
        if (props.onKeyDown) props.onKeyDown(e);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <Input
        {...props}
        value={value}
        onChange={e => {
          onValueChange(e.target.value);
          setIsOpen(true);
          setSelectedIndex(-1);
          if (props.onChange) props.onChange(e);
        }}
        onFocus={(e) => {
          if (options.length > 0) setIsOpen(true);
          if (props.onFocus) props.onFocus(e);
        }}
        onKeyDown={handleKeyDown}
        className={cn('w-full', className)}
        autoComplete="off"
      />
      <AnchoredListbox
        anchorRef={wrapperRef}
        isOpen={isOpen && filteredOptions.length > 0}
        listRef={listRef}
        className="bg-white dark:bg-popover"
      >
        {filteredOptions.map((opt, i) => (
          <div
            key={opt}
            className={cn(
              'px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-accent text-sm border-b border-border/50 last:border-0',
              selectedIndex === i && 'bg-slate-100 dark:bg-accent',
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onValueChange(opt);
              setIsOpen(false);
            }}
          >
            {opt}
          </div>
        ))}
      </AnchoredListbox>
    </div>
  );
}
