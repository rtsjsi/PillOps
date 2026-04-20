import { ExpiryUrgency } from './types';
import { EXPIRY_THRESHOLDS, INVOICE_PREFIX } from './constants';

// ─── ID Generation ────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ─── Currency Formatting ──────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Date Formatting ──────────────────────────────────────

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatExpiryDate(expiryStr: string): string {
  // expiryStr is "YYYY-MM"
  const [year, month] = expiryStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

// ─── Expiry Calculations ─────────────────────────────────

export function getDaysUntilExpiry(expiryStr: string | null | undefined): number {
  if (!expiryStr) return 9999; // Safe default for missing dates
  
  const parts = expiryStr.split('-');
  if (parts.length < 2) return 9999;

  const [year, month] = parts;
  // Expiry is end of month
  const expiryDate = new Date(parseInt(year), parseInt(month), 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffMs / 86400000);
}

export function getExpiryUrgency(daysRemaining: number): ExpiryUrgency {
  if (daysRemaining <= 0) return 'expired';
  if (daysRemaining <= EXPIRY_THRESHOLDS.CRITICAL) return 'critical';
  if (daysRemaining <= EXPIRY_THRESHOLDS.WARNING) return 'warning';
  if (daysRemaining <= EXPIRY_THRESHOLDS.WATCH) return 'watch';
  return 'safe';
}

export function getUrgencyLabel(urgency: ExpiryUrgency): string {
  switch (urgency) {
    case 'expired': return 'Expired';
    case 'critical': return 'Critical';
    case 'warning': return 'Expiring Soon';
    case 'watch': return 'Watch';
    case 'safe': return 'Safe';
  }
}

// ─── Stock Calculations ──────────────────────────────────

export function getTotalStock(batches: { quantity: number }[]): number {
  return batches.reduce((sum, b) => sum + b.quantity, 0);
}

export function getStockStatus(totalQty: number, reorderLevel: number): 'in-stock' | 'low' | 'out' {
  if (totalQty === 0) return 'out';
  if (totalQty <= reorderLevel) return 'low';
  return 'in-stock';
}

// ─── Invoice Number Generation ───────────────────────────

export function generateInvoiceNumber(lastNumber: number): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const seq = String(lastNumber + 1).padStart(3, '0');
  return `${INVOICE_PREFIX}-${dateStr}-${seq}`;
}

// ─── Greeting ─────────────────────────────────────────────

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ─── Search / Filter ─────────────────────────────────────

export function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return true;

  // Simple substring match + word boundary matching
  if (lowerText.includes(lowerQuery)) return true;

  // Check each word
  const words = lowerQuery.split(/\s+/);
  return words.every(word => lowerText.includes(word));
}

// ─── Misc ─────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || `${singular}s`);
}
