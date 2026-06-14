'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
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

  const filteredOptions = options
    .filter(o => o.toLowerCase().includes((value || '').toLowerCase()))
    .filter(o => o !== value) // Don't show exact match to avoid clutter
    .slice(0, 5);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <div className={cn("relative w-full", className)} ref={wrapperRef}>
      <Input
        {...props}
        value={value}
        onChange={e => {
          onValueChange(e.target.value);
          setIsOpen(true);
          if (props.onChange) props.onChange(e);
        }}
        onFocus={(e) => {
          if (options.length > 0) setIsOpen(true);
          if (props.onFocus) props.onFocus(e);
        }}
        onKeyDown={handleKeyDown}
        className="w-full"
        autoComplete="off"
      />
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 top-full left-0 w-full bg-white border shadow-xl rounded-xl mt-1 max-h-48 overflow-y-auto">
          {filteredOptions.map((opt, i) => (
            <div
              key={opt}
              className={cn("px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm border-b last:border-0", selectedIndex === i && "bg-slate-100")}
              onClick={() => {
                onValueChange(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
