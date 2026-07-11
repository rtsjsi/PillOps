'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { clearUserProfileCache, fetchUserProfile } from '@/lib/queries';
import { createClient } from '@/utils/supabase/client';

type UserProfile = Awaited<ReturnType<typeof fetchUserProfile>>;

type UserProfileContextValue = {
  profile: UserProfile;
  loading: boolean;
  refresh: () => Promise<void>;
};

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/' || pathname === '/login';
  const [profile, setProfile] = useState<UserProfile>(null);
  const [loading, setLoading] = useState(!isAuthPage);

  const loadProfile = useCallback(async (force = false) => {
    try {
      const data = await fetchUserProfile(force ? { force: true } : undefined);
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (isAuthPage) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    loadProfile(true).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthPage, loadProfile]);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearUserProfileCache();
        setProfile(null);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        clearUserProfileCache();
        if (!isAuthPage) {
          loadProfile(true);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [isAuthPage, loadProfile]);

  const refresh = useCallback(async () => {
    clearUserProfileCache();
    setLoading(true);
    await loadProfile(true);
    setLoading(false);
  }, [loadProfile]);

  return (
    <UserProfileContext.Provider value={{ profile, loading, refresh }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within UserProfileProvider');
  }
  return context;
}
