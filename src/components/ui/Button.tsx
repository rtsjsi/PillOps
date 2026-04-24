import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline';
  className?: string;
};

export default function Button({
  children,
  onClick,
  type = 'button',
  disabled = false,
  loading = false,
  variant = 'primary',
  className = '',
}: ButtonProps) {
  const baseClass = `btn ${variant === 'primary' ? 'btn-primary' : 'btn-outline'} ${className}`;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={baseClass}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : children}
    </button>
  );
}
