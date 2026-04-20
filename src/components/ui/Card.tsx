'use client';

import { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  noPadding?: boolean;
}

export function Card({ children, className = '', style = {}, onClick, noPadding = false }: CardProps) {
  return (
    <div 
      className={`glass-card ${className}`} 
      onClick={onClick}
      style={{
        padding: noPadding ? '0' : 'var(--space-4)',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
    >
      {children}
    </div>
  );
}
