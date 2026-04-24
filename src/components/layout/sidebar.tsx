'use client';

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
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Package, label: 'Inventory', href: '/inventory' },
  { icon: ShoppingCart, label: 'Point of Sale', href: '/pos' },
  { icon: BarChart3, label: 'Reports', href: '/admin' },
  { icon: Users, label: 'Staff List', href: '/staff' },
  { icon: User, label: 'My Profile', href: '/profile' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

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

  return (
    <aside className="hidden lg:flex w-72 flex-col border-r border-zinc-200 bg-white h-screen shrink-0">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3">
        <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 rotate-[-10deg]">
          <Pill size={24} />
        </div>
        <div>
          <h1 className="font-extrabold text-xl tracking-tighter leading-tight">PillOps</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Clinical Ops</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
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
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary text-white font-bold">JD</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-900 truncate">Pharmacist</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 truncate">Admin Access</p>
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
