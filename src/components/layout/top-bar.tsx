'use client';

import { Bell, Search, Menu, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function TopBar() {
  const pathname = usePathname();

  if (pathname === '/' || pathname === '/login') return null;

  const getTitle = () => {
    const segment = pathname.split('/')[1];
    if (!segment) return 'Dashboard';
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  return (
    <header className="h-[60px] border-b border-zinc-100 bg-white sticky top-0 z-40 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-[#44475b] lg:hidden">{getTitle()}</h1>
        
        <div className="hidden lg:flex items-center gap-2 text-[#7c7e8c] bg-zinc-50 border border-zinc-100 px-3 py-1.5 rounded-lg w-[400px] cursor-pointer hover:bg-zinc-100 transition-colors">
          <Search size={16} />
          <span className="text-sm">Search medicines, batches...</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-[#44475b] hover:bg-zinc-50 rounded-full">
          <Search size={22} className="lg:hidden" />
        </Button>
        <Button variant="ghost" size="icon" className="text-[#44475b] hover:bg-zinc-50 rounded-full">
          <Bell size={22} />
        </Button>
        
        <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[#ffead1] text-[#7d562d] flex items-center justify-center font-bold text-xs ring-1 ring-white shadow-sm">
                RJ
            </div>
        </div>
      </div>
    </header>
  );
}
