'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Pill } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchUserProfile } from '@/lib/queries';
import { getVisibleNavItems } from '@/lib/nav-config';

export function Sidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (pathname === '/' || pathname === '/login') return;
    fetchUserProfile().then(setProfile).catch(() => {});
  }, [pathname]);

  if (pathname === '/' || pathname === '/login') return null;

  const navItems = getVisibleNavItems(profile?.role);

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card h-screen shrink-0">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3">
        <div className="h-10 w-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center shadow-sm">
          <Pill size={20} />
        </div>
        <div>
          <h1 className="font-bold text-lg text-foreground tracking-tight">PillOps</h1>
          <p className="text-[10px] font-medium text-muted-foreground">
            {profile?.store?.name || 'Clinical Pharmacy'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                "flex items-center gap-3 px-3 h-11 rounded-lg transition-all duration-200 text-sm",
                isActive 
                  ? "bg-primary/8 text-primary font-bold" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon size={18} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
