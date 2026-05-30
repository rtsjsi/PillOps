'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, X, LayoutDashboard, Package, ShoppingCart, 
  Settings, Users, Pill, User, ShieldAlert 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function MobileSidebar({ profile }: { profile: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Package, label: 'Inventory', href: '/inventory' },
    { icon: ShoppingCart, label: 'Point of Sale', href: '/pos' },
    ...(profile?.role === 'super_admin' ? [
        { icon: ShieldAlert, label: 'Super Admin', href: '/admin' }
    ] : []),
    ...(['owner', 'super_admin'].includes(profile?.role) ? [
        { icon: Users, label: 'Staff Management', href: '/staff' }
    ] : []),
    { icon: User, label: 'My Profile', href: '/profile' },
    ...(['owner', 'super_admin'].includes(profile?.role) ? [
        { icon: Settings, label: 'Settings', href: '/settings' }
    ] : []),
  ];

  return (
    <div className="lg:hidden">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsOpen(true)}
        className="text-[#44475b] hover:bg-zinc-50 rounded-full"
      >
        <Menu size={24} />
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-50 transition-opacity backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 flex items-center justify-between border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary text-white rounded-lg flex items-center justify-center shadow-sm">
              <Pill size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg text-[#44475b] tracking-tight">PillOps</h1>
              <p className="text-[10px] font-medium text-[#7c7e8c] truncate w-32">
                {profile?.store?.name || 'Clinical Pharmacy'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="rounded-full">
            <X size={20} className="text-zinc-500" />
          </Button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 h-12 rounded-xl transition-all duration-200 text-[15px]",
                  isActive 
                    ? "bg-primary/10 text-primary font-bold shadow-sm" 
                    : "text-[#7c7e8c] hover:bg-zinc-50 hover:text-[#44475b]"
                )}
              >
                <Icon size={20} className={cn(isActive ? "text-primary" : "text-[#7c7e8c]")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
