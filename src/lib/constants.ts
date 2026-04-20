import { MedicineCategory } from './types';

// ─── Category Config ──────────────────────────────────────

export const CATEGORIES: { value: MedicineCategory; label: string; icon: string }[] = [
  { value: 'Tablet', label: 'Tablets', icon: '💊' },
  { value: 'Capsule', label: 'Capsules', icon: '🔵' },
  { value: 'Syrup', label: 'Syrups', icon: '🧴' },
  { value: 'Injection', label: 'Injections', icon: '💉' },
  { value: 'Ointment', label: 'Ointments', icon: '🧪' },
  { value: 'Drops', label: 'Drops', icon: '💧' },
  { value: 'Inhaler', label: 'Inhalers', icon: '🫁' },
  { value: 'Sachet', label: 'Sachets', icon: '📦' },
  { value: 'OTC', label: 'OTC', icon: '🛒' },
];

// ─── Tax Rates ────────────────────────────────────────────

export const DEFAULT_GST_PERCENT = 12;

export const GST_RATES: Record<string, number> = {
  '5': 5,
  '12': 12,
  '18': 18,
  '28': 28,
};

// ─── Expiry Thresholds (in days) ──────────────────────────

export const EXPIRY_THRESHOLDS = {
  CRITICAL: 30,
  WARNING: 90,
  WATCH: 180,
};

// ─── Store Defaults ───────────────────────────────────────

export const DEFAULT_STORE = {
  storeName: 'MedPlus Central Pharmacy',
  storeAddress: '12, MG Road, Bengaluru, Karnataka 560001',
  storePhone: '+91 80 4567 8900',
  gstin: '29AABCU9603R1ZM',
};

// ─── Invoice Prefix ───────────────────────────────────────

export const INVOICE_PREFIX = 'INV';

// ─── App Metadata ─────────────────────────────────────────

export const APP_NAME = 'PillOps';
export const APP_TAGLINE = 'Smart Pharmacy Operations';
export const APP_VERSION = '0.1.0-poc';
