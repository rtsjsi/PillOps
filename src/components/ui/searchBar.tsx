'use client';

import { Search, X } from 'lucide-react';
import { InputHTMLAttributes } from 'react';

interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export function SearchBar({ value, onChange, onClear, placeholder = 'Search...', className = '', ...props }: SearchBarProps) {
  return (
    <div 
      className={className}
      style={{ 
        position: 'relative', 
        display: 'flex', 
        alignItems: 'center',
        width: '100%'
      }}
    >
      <Search 
        size={18} 
        style={{ 
          position: 'absolute', 
          left: '12px', 
          color: 'var(--color-text-muted)' 
        }} 
      />
      
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '12px 36px 12px 40px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(107, 114, 128, 0.2)',
          background: 'var(--color-bg-glass)',
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-base)',
          outline: 'none',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
          transition: 'border-color 0.2s',
        }}
        {...props}
      />

      {value && onClear && (
        <button
          onClick={onClear}
          style={{
            position: 'absolute',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            color: 'var(--color-text-muted)'
          }}
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}


