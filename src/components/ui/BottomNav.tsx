'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, ShoppingCart, Clock } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  // Don't show bottom nav on splash screen
  if (pathname === '/') return null;

  const links = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/inventory', label: 'Inventory', icon: Package },
    { href: '/pos', label: 'POS', icon: ShoppingCart },
    { href: '/expiry', label: 'Expiry', icon: Clock },
  ];

  return (
    <nav className="bottom-nav">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={isActive ? 'active' : ''}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
