'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Search,
  User,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { getUserProfile } from '@/app/actions';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function loadProfile() {
        const p = await getUserProfile();
        setProfile(p);
    }
    loadProfile();
  }, []);

  if (pathname === '/' || pathname === '/login') return null;

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out successfully');
      router.push('/login');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Logout failed');
    }
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Package, label: 'Inventory', href: '/inventory' },
    { icon: ShoppingCart, label: 'Point of Sale', href: '/pos' },
    ...(profile?.role === 'super_admin' ? [
        { icon: ShieldAlert, label: 'Super Admin', href: '/admin' },
        { icon: Users, label: 'Global Users', href: '/admin?tab=users' }
    ] : []),
    ...(profile?.role === 'owner' ? [
        { icon: Users, label: 'Staff Management', href: '/staff' }
    ] : []),
    { icon: User, label: 'My Profile', href: '/profile' },
    { icon: Settings, label: 'Settings', href: '/settings' },
];

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-zinc-100 bg-white h-screen shrink-0">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3">
        <div className="h-10 w-10 bg-primary text-white rounded-lg flex items-center justify-center shadow-sm">
          <Pill size={20} />
        </div>
        <div>
          <h1 className="font-bold text-lg text-[#44475b] tracking-tight">PillOps</h1>
          <p className="text-[10px] font-medium text-[#7c7e8c]">
            {profile?.store?.name || 'Clinical Pharmacy'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 h-11 rounded-lg transition-all duration-200 text-sm",
                isActive 
                  ? "bg-primary/5 text-primary font-bold" 
                  : "text-[#7c7e8c] hover:bg-zinc-50 hover:text-[#44475b]"
              )}
            >
              <Icon size={18} className={cn(isActive ? "text-primary" : "text-[#7c7e8c]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Avatar Section */}
      <div className="p-4 mt-auto border-t border-zinc-100">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
          <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary text-white font-bold">
                {profile?.role === 'super_admin' ? 'SA' : 'PH'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate">
                {profile?.role === 'super_admin' ? 'Super Admin' : 'Pharmacist'}
            </p>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 truncate">
                {profile?.role === 'super_admin' ? 'System Global' : 'Local Admin'}
            </p>
          </div>
          <Button 
            onClick={handleLogout}
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-zinc-400 hover:text-rose-500 transition-colors"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
