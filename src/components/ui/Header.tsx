'use client';

import { useTheme } from './ThemeProvider';
import { Pill, Sun, Moon, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  if (pathname === '/' || pathname === '/login') return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="fixed-header">
      <div className="container header-inner">
        <Link href="/dashboard" className="brand">
          <div className="logo-icon">
            <Pill size={20} />
          </div>
          <span className="brand-name">PillOps</span>
        </Link>

        <div className="header-actions">
          <button onClick={toggleTheme} className="icon-btn" aria-label="Toggle theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          
          <Link href="/profile" className="icon-btn" aria-label="Profile">
            <User size={20} />
          </Link>

          <button onClick={handleLogout} className="icon-btn logout-btn" aria-label="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
