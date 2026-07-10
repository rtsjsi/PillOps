'use client';

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

/** Positions a fixed element below its anchor; updates on scroll/resize. */
export function useAnchoredPortal(
  anchorRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  offset = 4,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  useEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const maxHeight = Math.max(120, window.innerHeight - rect.bottom - offset - 12);

      setStyle({
        position: 'fixed',
        top: rect.bottom + offset,
        left: rect.left,
        width: rect.width,
        maxHeight,
        zIndex: 9999,
        visibility: 'visible',
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchorRef, isOpen, offset]);

  return style;
}

export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  onOutside: () => void,
  enabled = true,
) {
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    if (!enabled) return;

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (refsRef.current.some((ref) => ref.current?.contains(target))) return;
      onOutside();
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onOutside, enabled]);
}
