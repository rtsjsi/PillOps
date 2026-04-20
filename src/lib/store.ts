import { Medicine, Invoice, StoreData } from './types';
import { DEFAULT_STORE } from './constants';
import { getSeedData } from './seed-data';

const STORE_KEY = 'pillops_data';

// ─── Initialize / Load ───────────────────────────────────

function getDefaultState(): StoreData {
  const seed = getSeedData();
  return {
    ...DEFAULT_STORE,
    medicines: seed.medicines,
    invoices: seed.invoices,
    purchases: [],
    lastInvoiceNumber: seed.invoices.length,
  };
}

export function loadStore(): StoreData {
  if (typeof window === 'undefined') return getDefaultState();

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      return JSON.parse(raw) as StoreData;
    }
  } catch {
    console.warn('PillOps: Failed to load store, resetting to defaults');
  }

  const defaults = getDefaultState();
  saveStore(defaults);
  return defaults;
}

export function saveStore(data: StoreData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    console.error('PillOps: Failed to save store');
  }
}

export function resetStore(): StoreData {
  const defaults = getDefaultState();
  saveStore(defaults);
  return defaults;
}

// ─── Medicine CRUD ────────────────────────────────────────

export function addMedicine(medicine: Medicine): StoreData {
  const store = loadStore();
  store.medicines.push(medicine);
  saveStore(store);
  return store;
}

export function updateMedicine(id: string, updates: Partial<Medicine>): StoreData {
  const store = loadStore();
  const index = store.medicines.findIndex(m => m.id === id);
  if (index !== -1) {
    store.medicines[index] = { ...store.medicines[index], ...updates, updatedAt: new Date().toISOString() };
  }
  saveStore(store);
  return store;
}

export function deleteMedicine(id: string): StoreData {
  const store = loadStore();
  store.medicines = store.medicines.filter(m => m.id !== id);
  saveStore(store);
  return store;
}

// ─── Invoice CRUD ─────────────────────────────────────────

export function addInvoice(invoice: Invoice, updatedMedicines: Medicine[]): StoreData {
  const store = loadStore();
  store.invoices.unshift(invoice); // newest first
  store.lastInvoiceNumber += 1;

  // Update medicine stock
  for (const med of updatedMedicines) {
    const idx = store.medicines.findIndex(m => m.id === med.id);
    if (idx !== -1) {
      store.medicines[idx] = med;
    }
  }

  saveStore(store);
  return store;
}

export function getInvoiceById(id: string): Invoice | undefined {
  const store = loadStore();
  return store.invoices.find(inv => inv.id === id);
}


// ─── Purchase CRUD ────────────────────────────────────────

export function addPurchaseInvoice(invoice: import('./types').PurchaseInvoice, updatedMedicines: import('./types').Medicine[]): StoreData {
  const store = loadStore();
  
  if (!store.purchases) store.purchases = [];
  store.purchases.unshift(invoice); // Newest first

  // Update existing medicines or add new ones by merging batches
  for (const med of updatedMedicines) {
    const idx = store.medicines.findIndex(m => m.id === med.id);
    if (idx !== -1) {
      // Merge batches and master data deltas (like HSN/Mfr)
      const existingMed = store.medicines[idx];
      const newBatches = [...existingMed.batches];
      
      for (const incomingBatch of med.batches) {
        const batchIdx = newBatches.findIndex(b => b.batchNumber === incomingBatch.batchNumber);
        if (batchIdx !== -1) {
          newBatches[batchIdx] = {
            ...newBatches[batchIdx],
            quantity: newBatches[batchIdx].quantity + incomingBatch.quantity
          };
        } else {
          newBatches.push(incomingBatch);
        }
      }
      
      store.medicines[idx] = { 
        ...existingMed,
        hsnCode: existingMed.hsnCode || med.hsnCode,
        manufacturer: existingMed.manufacturer || med.manufacturer,
        batches: newBatches,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Completely new medicine
      store.medicines.push(med);
    }
  }

  saveStore(store);
  return store;
}
