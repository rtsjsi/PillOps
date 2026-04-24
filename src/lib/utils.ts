import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function formatRelativeTime(date: string) {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const diffInMins = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

  if (diffInMins < 1) return 'Just now';
  if (diffInMins < 60) return `${diffInMins}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return past.toLocaleDateString();
}

export function fuzzyMatch(query: string, text: string) {
  return text.toLowerCase().includes(query.toLowerCase());
}

export function getTotalStock(batches: any[]) {
  return batches.reduce((sum, b) => sum + b.quantity, 0);
}

export function getStockStatus(total: number, min: number = 10) {
  if (total <= 0) return 'out';
  if (total <= min) return 'low';
  return 'ok';
}

export function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export function generateInvoiceNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${year}${month}-${random}`;
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getDaysUntilExpiry(expiryDate: string) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffInMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
}

export function getExpiryUrgency(days: number) {
  if (days <= 30) return 'critical';
  if (days <= 90) return 'warning';
  return 'safe';
}

export function formatExpiryDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}
