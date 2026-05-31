'use client';

import { useEffect, useCallback, useRef } from 'react';

interface ShortcutConfig {
  /** The keyboard key (e.g. 'F2', 'Enter', 'Escape', 'n') */
  key: string;
  /** Modifier keys */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Callback when shortcut fires */
  action: () => void;
  /** Description for help/tooltips */
  description?: string;
  /** If true, fires even when an input/textarea is focused. Default: false */
  allowInInput?: boolean;
}

/**
 * Global keyboard shortcut hook.
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: 'F2', action: () => startNewSale(), description: 'New Sale' },
 *   { key: 'Enter', ctrl: true, action: () => checkout(), description: 'Checkout' },
 *   { key: 'Escape', action: () => clearSearch(), allowInInput: true },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInputFocused =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;

    for (const shortcut of shortcutsRef.current) {
      const keyMatch = e.key === shortcut.key || e.code === shortcut.key;
      const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
      const shiftMatch = !!shortcut.shift === e.shiftKey;
      const altMatch = !!shortcut.alt === e.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        // Skip if focused in an input and shortcut doesn't allow it
        if (isInputFocused && !shortcut.allowInInput) {
          // Always allow function keys and Escape in inputs
          const isFunctionKey = e.key.startsWith('F') && e.key.length <= 3;
          if (!isFunctionKey && e.key !== 'Escape') continue;
        }

        e.preventDefault();
        e.stopPropagation();
        shortcut.action();
        return;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);
}
