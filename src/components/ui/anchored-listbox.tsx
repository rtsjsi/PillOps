'use client';

import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useAnchoredPortal } from '@/hooks/use-anchored-portal';

interface AnchoredListboxProps {
  anchorRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
  listRef?: RefObject<HTMLDivElement | null>;
}

/** Renders a dropdown list in a portal so parent overflow cannot clip it. */
export function AnchoredListbox({
  anchorRef,
  isOpen,
  children,
  className,
  listRef,
}: AnchoredListboxProps) {
  const [mounted, setMounted] = useState(false);
  const style = useAnchoredPortal(anchorRef, isOpen);

  useEffect(() => setMounted(true), []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      ref={listRef}
      style={style}
      className={cn(
        'overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
