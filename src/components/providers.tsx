'use client';

import { ThemeProvider } from '@/components/ui/themeProvider';
import { UserProfileProvider } from '@/contexts/user-profile-context';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <UserProfileProvider>
        {children}
        <Toaster position="top-center" richColors />
      </UserProfileProvider>
    </ThemeProvider>
  );
}
