'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, ShoppingCart, BarChart3, User, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === '/' || pathname === '/login') return null;

  const links = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/inventory', label: 'Stock', icon: Package },
    { href: '/pos', label: 'Sale', icon: ShoppingCart },
    { href: '/admin', label: 'Reports', icon: BarChart3 },
    { href: '/profile', label: 'Staff', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[45] h-[80px] bg-background/80 backdrop-blur-2xl border-t border-border flex items-center justify-around px-2 pb-safe md:hidden">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
        
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-300 min-h-[44px]",
              isActive ? "text-primary translate-y-[-4px]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-2 rounded-2xl transition-all duration-300",
              isActive ? "bg-primary/15 shadow-lg shadow-primary/10 ring-1 ring-primary/20" : "bg-transparent"
            )}>
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={cn(
                "text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                isActive ? "opacity-100 scale-100" : "opacity-60 scale-90"
            )}>
                {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
