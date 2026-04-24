'use client';

import { usePathname } from 'next/navigation';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Specifically skip the splash screen since it has its own hardcoded entrance animation
  if (pathname === '/') {
      return <>{children}</>;
  }

  return (
    <div key={pathname} className="animate-page-in w-full h-full">
      {children}
    </div>
  );
}
