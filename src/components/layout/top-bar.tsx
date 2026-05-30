'use client';

import { Bell, Search, LogOut, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getUserProfile, getAvailableStoresForSuperAdmin } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');

  useEffect(() => {
    if (pathname === '/' || pathname === '/login') return;
    getUserProfile().then(p => {
      setProfile(p);
      if (p?.role === 'super_admin') {
        getAvailableStoresForSuperAdmin().then(setStores).catch(() => {});
        
        // Read cookie to set initial select value
        const match = document.cookie.match(new RegExp('(^| )pillops_selected_store_id=([^;]+)'));
        if (match) setSelectedStore(match[2]);
      }
    }).catch(() => {});
  }, [pathname]);

  if (pathname === '/' || pathname === '/login') return null;

  const getTitle = () => {
    const segment = pathname.split('/')[1];
    if (!segment) return 'Dashboard';
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : profile?.role === 'super_admin' ? 'SA' : 'PH';

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.replace('/login');
    } catch {
      toast.error('Logout failed');
      setSigningOut(false);
    }
  };

  const handleStoreChange = (storeId: string | null) => {
    if (!storeId) return;
    setSelectedStore(storeId);
    document.cookie = `pillops_selected_store_id=${storeId}; path=/; max-age=31536000`; // 1 year expiry
    window.location.reload(); // Reload to refresh server components with the new store context
  };

  return (
    <header className="h-[60px] border-b border-zinc-100 bg-white sticky top-0 z-40 px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <MobileSidebar profile={profile} />
        <h1 className="text-xl font-bold text-[#44475b] lg:hidden ml-1">{getTitle()}</h1>

        <div className="hidden lg:flex items-center gap-2 text-[#7c7e8c] bg-zinc-50 border border-zinc-100 px-3 py-1.5 rounded-lg w-[400px] cursor-pointer hover:bg-zinc-100 transition-colors">
          <Search size={16} />
          <span className="text-sm">Search medicines, batches...</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Super Admin Store Selector */}
        {profile?.role === 'super_admin' && (
          <div className="hidden sm:flex items-center gap-2 mr-2">
            <Store size={16} className="text-primary" />
            <Select value={selectedStore} onValueChange={handleStoreChange}>
              <SelectTrigger className="w-[200px] h-9 text-xs font-bold rounded-xl border-slate-200 bg-slate-50">
                <SelectValue placeholder="Select Pharmacy" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button variant="ghost" size="icon" className="text-[#44475b] hover:bg-zinc-50 rounded-full lg:hidden">
          <Search size={22} />
        </Button>

        <Button variant="ghost" size="icon" className="text-[#44475b] hover:bg-zinc-50 rounded-full">
          <Bell size={20} />
        </Button>

        {/* Profile button */}
        <Link href="/profile">
          <button className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm hover:ring-primary/30 transition-all">
            {initials}
          </button>
        </Link>

        {/* Sign out button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={signingOut}
          className="text-[#7c7e8c] hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
          title="Sign out"
        >
          <LogOut size={18} className={signingOut ? 'animate-pulse' : ''} />
        </Button>
      </div>
    </header>
  );
}
