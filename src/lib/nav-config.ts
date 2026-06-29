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
  FileText,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  /** Roles allowed to see this item. If empty/undefined, visible to all. */
  roles?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Package, label: 'Inventory', href: '/inventory' },
  { icon: Database, label: 'Medicine Directory', href: '/medicines' },
  { icon: ArrowDownToLine, label: 'Purchases', href: '/purchases' },
  { icon: ShoppingCart, label: 'Point of Sale', href: '/pos' },
  { icon: Clock, label: 'Expiry Radar', href: '/expiry' },
  { icon: FileText, label: 'Reports', href: '/reports', roles: ['owner', 'super_admin', 'staff'] },
  { icon: ShieldAlert, label: 'Super Admin', href: '/admin', roles: ['super_admin'] },
  { icon: Users, label: 'Staff Management', href: '/staff', roles: ['owner', 'super_admin'] },
  { icon: User, label: 'My Profile', href: '/profile' },
  { icon: Settings, label: 'Settings', href: '/settings', roles: ['owner', 'super_admin'] },
];

/** Filter nav items based on the user's role. */
export function getVisibleNavItems(role?: string | null): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return role ? item.roles.includes(role) : false;
  });
}
