'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { fetchUserProfile } from '@/lib/queries';
import { getBottomNavItems } from '@/lib/nav-config';

export default function BottomNav() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (pathname === '/' || pathname === '/login') return;
    fetchUserProfile().then(setProfile).catch(() => {});
  }, [pathname]);

  if (pathname === '/' || pathname === '/login') return null;

  const links = getBottomNavItems(profile?.role);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[45] h-[65px] bg-card border-t border-border flex items-center justify-around px-2 pb-safe md:hidden shadow-[0_-1px_10px_rgba(0,0,0,0.03)]"
      aria-label="Quick navigation"
    >
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
        
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-200",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="p-1">
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
            </div>
            <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive ? "text-primary font-bold" : "text-muted-foreground"
            )}>
                {link.shortLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
