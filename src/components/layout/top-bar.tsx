'use client';

import { Bell, Search, Menu, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function TopBar() {
  const pathname = usePathname();

  if (pathname === '/' || pathname === '/login') return null;

  return (
    <header className="h-[70px] border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle (Simplified) */}
        <Button variant="ghost" size="icon" className="lg:hidden rounded-xl">
          <Menu size={20} />
        </Button>
        
        <div className="hidden lg:flex items-center gap-2 text-zinc-400 group cursor-pointer hover:text-zinc-600 transition-colors">
          <Search size={18} />
          <span className="text-sm font-bold">Search everything...</span>
          <div className="flex items-center gap-1 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 text-[10px] font-black tracking-tighter">
             <Command size={10} /> K
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Button variant="ghost" size="icon" className="rounded-full bg-zinc-50 hover:bg-zinc-100 text-zinc-600">
            <Bell size={20} />
          </Button>
          <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-rose-500 border-2 border-white rounded-full text-[8px] font-black text-white flex items-center justify-center animate-pulse">
            3
          </span>
        </div>
        
        <div className="h-8 w-px bg-zinc-200 mx-2 hidden sm:block" />
        
        <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Apollo Pharmacy</span>
            <span className="text-xs font-bold text-zinc-500">Banjara Hills, Hyd</span>
        </div>
      </div>
    </header>
  );
}
