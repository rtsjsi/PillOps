'use client';

import { useState, useEffect } from 'react';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem('pillops_theme') as 'light' | 'dark' | null;
    if (stored) {
      setTheme(stored);
    } else {
      const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pillops_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  return (
    <>
      <button
        onClick={toggleTheme}
        className="btn btn-outline"
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000 }}
        aria-label="Toggle light/dark mode"
      >
        {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
      </button>
      {children}
    </>
  );
}
