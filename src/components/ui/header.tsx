'use client';

import { useTheme } from './themeProvider';
import { Pill, Sun, Moon, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

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
    <header className="fixed top-0 left-0 right-0 z-50 h-[70px] bg-background/80 backdrop-blur-xl border-b border-border flex items-center">
      <div className="container flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="bg-primary text-white p-2 rounded-xl group-hover:scale-110 transition-transform shadow-lg shadow-primary/20">
            <Pill size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight">PillOps</span>
        </Link>

        <div className="flex items-center gap-1">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-full border border-border mr-2 cursor-default group">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-primary transition-colors">Command Palette</span>
            <kbd className="text-[10px] font-bold bg-background px-1.5 py-0.5 rounded border border-border text-muted-foreground group-hover:border-primary/50 group-hover:text-primary transition-all">⌘K</kbd>
          </div>
          
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </Button>
          
          <Button variant="ghost" size="icon" render={<Link href="/profile" />} className="rounded-full">
              <User size={20} />
          </Button>

          <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full text-red-500 hover:text-red-600 hover:bg-red-500/10">
            <LogOut size={20} />
          </Button>
        </div>
      </div>
    </header>
  );
}


