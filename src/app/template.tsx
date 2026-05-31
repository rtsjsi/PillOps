'use client';

import { usePathname } from 'next/navigation';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Skip animation for splash screen (has its own entrance animation)
  if (pathname === '/') {
    return <>{children}</>;
  }

  // Use CSS animation class but NO key={pathname} — that would remount
  // all children on every route change, destroying form state.
  return (
    <div className="animate-page-in w-full h-full">
      {children}
    </div>
  );
}
