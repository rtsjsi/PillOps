import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  Users,
  User,
  ShieldAlert,
  ArrowDownToLine,
  Clock,
  Database,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  /** Short label for bottom nav on mobile */
  shortLabel: string;
  href: string;
  /** Roles allowed to see this item. If empty/undefined, visible to all. */
  roles?: string[];
  /** Whether to show in the bottom mobile nav */
  showInBottomNav?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    shortLabel: 'Home',
    href: '/dashboard',
    showInBottomNav: true,
  },
  {
    icon: Package,
    label: 'Inventory',
    shortLabel: 'Stock',
    href: '/inventory',
    showInBottomNav: true,
  },
  {
    icon: Database,
    label: 'Medicine Directory',
    shortLabel: 'Medicines',
    href: '/medicines',
    showInBottomNav: true,
  },
  {
    icon: ArrowDownToLine,
    label: 'Purchases',
    shortLabel: 'Buy',
    href: '/purchases',
    showInBottomNav: false,
  },
  {
    icon: ShoppingCart,
    label: 'Point of Sale',
    shortLabel: 'Sale',
    href: '/pos',
    showInBottomNav: true,
  },
  {
    icon: Clock,
    label: 'Expiry Radar',
    shortLabel: 'Expiry',
    href: '/expiry',
    showInBottomNav: true,
  },
  {
    icon: ShieldAlert,
    label: 'Super Admin',
    shortLabel: 'Admin',
    href: '/admin',
    roles: ['super_admin'],
    showInBottomNav: false,
  },
  {
    icon: Users,
    label: 'Staff Management',
    shortLabel: 'Staff',
    href: '/staff',
    roles: ['owner', 'super_admin'],
    showInBottomNav: false,
  },
  {
    icon: User,
    label: 'My Profile',
    shortLabel: 'Profile',
    href: '/profile',
    showInBottomNav: true,
  },
  {
    icon: Settings,
    label: 'Settings',
    shortLabel: 'Settings',
    href: '/settings',
    roles: ['owner', 'super_admin'],
    showInBottomNav: false,
  },
];

/**
 * Filter nav items based on the user's role.
 */
export function getVisibleNavItems(role?: string | null): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return role ? item.roles.includes(role) : false;
  });
}

/**
 * Get bottom nav items (subset shown on mobile).
 */
export function getBottomNavItems(role?: string | null): NavItem[] {
  return getVisibleNavItems(role).filter((item) => item.showInBottomNav);
}
