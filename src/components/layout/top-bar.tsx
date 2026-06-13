'use client';

import { Bell, Search, LogOut, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchUserProfile } from '@/lib/queries';
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
    fetchUserProfile().then(p => {
      setProfile(p);
      if (p?.role === 'super_admin') {
        const supabase = createClient();
        const fetchStores = async () => {
          const { data } = await supabase.from('stores').select('id, name').order('name');
          setStores(data || []);
        };
        fetchStores();
        
        // Read cookie to set initial select value
        const match = document.cookie.match(new RegExp('(^| )pillops_selected_store_id=([^;]+)'));
        if (match) setSelectedStore(match[2]);
      }
    }).catch(() => {});
  }, [pathname]);

  if (pathname === '/' || pathname === '/login') return null;

  const getTitle = () => {
    if (!pathname) return 'Dashboard';
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
    document.cookie = `pillops_selected_store_id=${storeId}; path=/; max-age=31536000`;
    window.location.reload();
  };

  return (
    <header className="h-[60px] border-b border-border bg-card sticky top-0 z-40 px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <MobileSidebar profile={profile} />
        <h1 className="text-xl font-bold text-foreground lg:hidden ml-1">{getTitle()}</h1>

        <div
          className="hidden lg:flex items-center gap-2 text-muted-foreground bg-muted/50 border border-border px-3 py-1.5 rounded-lg w-[400px] cursor-pointer hover:bg-muted transition-colors"
          role="button"
          tabIndex={0}
          aria-label="Search medicines and batches"
          onClick={() => {
            // Focus the search on the current page if available
            const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
            if (searchInput) searchInput.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
              if (searchInput) searchInput.focus();
            }
          }}
        >
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
              <SelectTrigger className="w-[200px] h-9 text-xs font-bold rounded-xl border-border bg-muted/50">
                <span className="truncate">{stores.find(s => s.id === selectedStore)?.name || "Select Pharmacy"}</span>
              </SelectTrigger>
              <SelectContent>
                {stores.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="text-foreground hover:bg-muted rounded-full lg:hidden"
          aria-label="Search"
        >
          <Search size={22} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="text-foreground hover:bg-muted rounded-full"
          aria-label="Notifications"
        >
          <Bell size={20} />
        </Button>

        {/* Profile button */}
        <Link
          href="/profile"
          className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs ring-2 ring-background shadow-sm hover:ring-primary/30 transition-all"
          aria-label="View profile"
        >
          {initials}
        </Link>

        {/* Sign out button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          disabled={signingOut}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
          aria-label="Sign out"
        >
          <LogOut size={18} className={signingOut ? 'animate-pulse' : ''} />
        </Button>
      </div>
    </header>
  );
}
