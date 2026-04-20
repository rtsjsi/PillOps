'use client';

import { ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const getStyle = () => {
    switch (variant) {
      case 'success':
        return { background: 'var(--color-success)', color: 'white' };
      case 'warning':
        return { background: 'var(--color-warning)', color: 'white' };
      case 'danger':
        return { background: 'var(--color-danger)', color: 'white' };
      case 'info':
        return { background: 'var(--color-primary)', color: 'white' };
      default:
        return { background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-text-muted)' };
    }
  };

  return (
    <span 
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2em 0.6em',
        borderRadius: '100px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        lineHeight: 1,
        ...getStyle()
      }}
    >
      {children}
    </span>
  );
}
