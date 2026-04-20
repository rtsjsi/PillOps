// ─── Medicine Types ────────────────────────────────────────

export type MedicineCategory =
  | 'Tablet'
  | 'Capsule'
  | 'Syrup'
  | 'Injection'
  | 'Ointment'
  | 'Drops'
  | 'Inhaler'
  | 'Sachet'
  | 'OTC';

export type DrugSchedule = 'H' | 'H1' | 'X' | 'OTC';

export interface Batch {
  id: string;
  batchNumber: string;
  quantity: number;
  purchasePrice: number;
  mrp: number;
  expiryDate: string; // "YYYY-MM"
  receivedDate: string; // "YYYY-MM-DD"
}

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: MedicineCategory;
  manufacturer: string;
  hsnCode: string;
  schedule: DrugSchedule;
  batches: Batch[];
  reorderLevel: number;
  rack: string;
  gstPercent: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Sales / POS Types ────────────────────────────────────

export interface CartItem {
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  mrp: number;
  gstPercent: number;
  expiryDate: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  items: CartItem[];
  subtotal: number;
  gstAmount: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  createdAt: string;
}

// ─── Expiry Types ─────────────────────────────────────────

export type ExpiryUrgency = 'expired' | 'critical' | 'warning' | 'watch' | 'safe';

export interface ExpiryItem {
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  mrp: number;
  expiryDate: string;
  daysRemaining: number;
  urgency: ExpiryUrgency;
  valueAtRisk: number;
}

// ─── Purchase Types ─────────────────────────────────────────

export interface PurchaseItem {
  medicineId: string;
  medicineName: string;
  pack: string;
  batchNumber: string;
  hsnCode?: string;
  manufacturer?: string;
  quantity: number;
  freeQuantity: number;
  purchasePrice: number;
  discountPercent: number;
  mrp: number;
  gstPercent: number;
  expiryDate: string;
  totalAmount: number;
}

export interface PurchaseInvoice {
  id: string;
  distributorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  items: PurchaseItem[];
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  total: number;
  createdAt: string;
}

// ─── Store State ──────────────────────────────────────────

export interface StoreData {
  medicines: Medicine[];
  invoices: Invoice[];
  purchases: PurchaseInvoice[];
  storeName: string;
  storeAddress: string;
  storePhone: string;
  gstin: string;
  lastInvoiceNumber: number;
}
