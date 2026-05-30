'use client';

import { Bell, Search, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getUserProfile } from '@/app/actions';

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    getUserProfile().then(setProfile).catch(() => {});
  }, []);

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
      // Hard redirect — fastest way to clear state and hit middleware
      window.location.replace('/login');
    } catch {
      toast.error('Logout failed');
      setSigningOut(false);
    }
  };

  return (
    <header className="h-[60px] border-b border-zinc-100 bg-white sticky top-0 z-40 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-[#44475b] lg:hidden">{getTitle()}</h1>

        <div className="hidden lg:flex items-center gap-2 text-[#7c7e8c] bg-zinc-50 border border-zinc-100 px-3 py-1.5 rounded-lg w-[400px] cursor-pointer hover:bg-zinc-100 transition-colors">
          <Search size={16} />
          <span className="text-sm">Search medicines, batches...</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
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
