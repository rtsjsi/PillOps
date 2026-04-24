'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, ShoppingCart, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === '/' || pathname === '/login') return null;

  const links = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/inventory', label: 'Stocks', icon: Package },
    { href: '/pos', label: 'POS', icon: ShoppingCart },
    { href: '/expiry', label: 'Alerts', icon: Clock },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-[80px] bg-background/80 backdrop-blur-xl border-t border-border flex items-center justify-around px-4">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-200",
              isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-colors",
              isActive ? "bg-primary/10" : "bg-transparent"
            )}>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}


