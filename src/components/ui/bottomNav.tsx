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
    <nav className="fixed bottom-0 left-0 right-0 z-[45] h-[65px] bg-white border-t border-zinc-100 flex items-center justify-around px-2 pb-safe md:hidden shadow-[0_-1px_10px_rgba(0,0,0,0.02)]">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
        
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-200",
              isActive ? "text-primary" : "text-[#7c7e8c] hover:text-[#44475b]"
            )}
          >
            <div className="p-1">
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            </div>
            <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive ? "text-primary" : "text-[#7c7e8c]"
            )}>
                {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
