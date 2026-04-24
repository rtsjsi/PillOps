'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Settings, 
  Users, 
  Pill,
  LogOut,
  Bell,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Package, label: 'Inventory', href: '/inventory' },
  { icon: ShoppingCart, label: 'Point of Sale', href: '/pos' },
  { icon: BarChart3, label: 'Reports', href: '/admin' },
  { icon: Users, label: 'Staff Management', href: '/staff' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  if (pathname === '/' || pathname === '/login') return null;

  return (
    <aside className="hidden lg:flex w-72 flex-col border-r border-zinc-200 bg-white h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3">
        <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 rotate-[-10deg]">
          <Pill size={24} />
        </div>
        <div>
          <h1 className="font-extrabold text-xl tracking-tighter leading-tight">PillOps</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Clinical Operations</p>
        </div>
      </div>

      {/* Search Shortcut */}
      <div className="px-4 mb-6">
        <button className="w-full flex items-center justify-between px-4 h-10 bg-zinc-100 rounded-xl text-zinc-500 hover:bg-zinc-200 transition-colors group">
          <div className="flex items-center gap-2">
            <Search size={16} />
            <span className="text-xs font-bold">Quick Search...</span>
          </div>
          <kbd className="text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-zinc-200">⌘K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 h-12 rounded-xl transition-all duration-300 font-bold text-sm group",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <Icon size={20} className={cn(isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-900")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Avatar Section */}
      <div className="p-4 mt-auto border-t border-zinc-100">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
          <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
            <AvatarImage src="/avatar-placeholder.png" />
            <AvatarFallback className="bg-primary text-white font-bold">JD</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate">John Pharmacist</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Store Owner</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-rose-500">
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
