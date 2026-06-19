'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getVisibleNavItems } from '@/lib/nav-config';

export function MobileSidebar({ profile }: { profile: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const navItems = getVisibleNavItems(profile?.role);

  return (
    <div className="lg:hidden">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsOpen(true)}
        className="text-foreground hover:bg-muted rounded-full"
        aria-label="Open navigation menu"
      >
        <Menu size={24} />
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-50 transition-opacity backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          role="presentation"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="p-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center shadow-sm">
              <Pill size={16} />
            </div>
            <div>
              <h1 className="font-bold text-base text-foreground tracking-tight">PillOps</h1>
              <p className="text-[10px] font-medium text-muted-foreground truncate w-32">
                {profile?.store?.name || 'Clinical Pharmacy'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="rounded-full"
            aria-label="Close navigation menu"
          >
            <X size={20} className="text-muted-foreground" />
          </Button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-4" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-3 h-10 rounded-xl transition-all duration-200 text-sm",
                  isActive 
                    ? "bg-primary/10 text-primary font-bold shadow-sm" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={18} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
