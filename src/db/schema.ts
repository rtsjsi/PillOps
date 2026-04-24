import { pgTable, text, timestamp, integer, doublePrecision, uuid, varchar, date, pgEnum, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const medicineCategoryEnum = pgEnum('medicine_category', [
  'Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Sachet', 'OTC'
]);

export const drugScheduleEnum = pgEnum('drug_schedule', ['H', 'H1', 'X', 'OTC']);

// ─── SaaS / Multi-tenancy ───────────────────────────────────

export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  gstin: varchar('gstin', { length: 20 }),
  lastInvoiceNumber: integer('last_invoice_number').default(0),
  subscriptionTier: varchar('subscription_tier', { length: 50 }).default('free'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey(), // Links to auth.users.id
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).default('staff'), // 'super_admin', 'owner', 'staff'

  fullName: varchar('full_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Medicines ──────────────────────────────────────────────
export const medicines = pgTable('medicines', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  genericName: varchar('generic_name', { length: 255 }),
  category: medicineCategoryEnum('category').notNull(),
  manufacturer: varchar('manufacturer', { length: 255 }),
  hsnCode: varchar('hsn_code', { length: 20 }),
  schedule: drugScheduleEnum('schedule').default('OTC'),
  reorderLevel: integer('reorder_level').default(10),
  rack: varchar('rack', { length: 50 }),
  gstPercent: doublePrecision('gst_percent').default(12),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Batches ────────────────────────────────────────────────
export const batches = pgTable('batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  medicineId: uuid('medicine_id').references(() => medicines.id, { onDelete: 'cascade' }).notNull(),
  batchNumber: varchar('batch_number', { length: 50 }).notNull(),
  quantity: integer('quantity').notNull().default(0),
  purchasePrice: doublePrecision('purchase_price').notNull(),
  mrp: doublePrecision('mrp').notNull(),
  expiryDate: varchar('expiry_date', { length: 7 }).notNull(), // "YYYY-MM"
  receivedDate: date('received_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Sales Invoices ─────────────────────────────────────────
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  customerName: varchar('customer_name', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 20 }),
  subtotal: doublePrecision('subtotal').notNull(),
  gstAmount: doublePrecision('gst_amount').notNull(),
  discountPercent: doublePrecision('discount_percent').default(0),
  discountAmount: doublePrecision('discount_amount').default(0),
  total: doublePrecision('total').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  medicineId: uuid('medicine_id').references(() => medicines.id).notNull(),
  batchId: uuid('batch_id').references(() => batches.id).notNull(),
  quantity: integer('quantity').notNull(),
  mrp: doublePrecision('mrp').notNull(),
  gstPercent: doublePrecision('gst_percent').notNull(),
  expiryDate: varchar('expiry_date', { length: 7 }).notNull(),
});

// ─── Purchase Invoices ──────────────────────────────────────
export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  distributorName: varchar('distributor_name', { length: 255 }).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  subtotal: doublePrecision('subtotal').notNull(),
  discountAmount: doublePrecision('discount_amount').default(0),
  gstAmount: doublePrecision('gst_amount').notNull(),
  total: doublePrecision('total').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const purchaseItems = pgTable('purchase_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  purchaseId: uuid('purchase_id').references(() => purchases.id, { onDelete: 'cascade' }).notNull(),
  medicineId: uuid('medicine_id').references(() => medicines.id).notNull(),
  medicineName: varchar('medicine_name', { length: 255 }).notNull(),
  batchNumber: varchar('batch_number', { length: 50 }).notNull(),
  quantity: integer('quantity').notNull(),
  freeQuantity: integer('free_quantity').default(0),
  purchasePrice: doublePrecision('purchase_price').notNull(),
  discountPercent: doublePrecision('discount_percent').default(0),
  mrp: doublePrecision('mrp').notNull(),
  gstPercent: doublePrecision('gst_percent').notNull(),
  expiryDate: varchar('expiry_date', { length: 7 }).notNull(),
  totalAmount: doublePrecision('total_amount').notNull(),
});

// ─── Relations ──────────────────────────────────────────────

export const storesRelations = relations(stores, ({ many }) => ({
  medicines: many(medicines),
  invoices: many(invoices),
  purchases: many(purchases),
  users: many(userProfiles),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  store: one(stores, {
    fields: [userProfiles.storeId],
    references: [stores.id],
  }),
}));

export const medicinesRelations = relations(medicines, ({ one, many }) => ({
  store: one(stores, {
    fields: [medicines.storeId],
    references: [stores.id],
  }),
  batches: many(batches),
}));

export const batchesRelations = relations(batches, ({ one }) => ({
  store: one(stores, {
    fields: [batches.storeId],
    references: [stores.id],
  }),
  medicine: one(medicines, {
    fields: [batches.medicineId],
    references: [medicines.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  store: one(stores, {
    fields: [invoices.storeId],
    references: [stores.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  medicine: one(medicines, {
    fields: [invoiceItems.medicineId],
    references: [medicines.id],
  }),
  batch: one(batches, {
    fields: [invoiceItems.batchId],
    references: [batches.id],
  }),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  store: one(stores, {
    fields: [purchases.storeId],
    references: [stores.id],
  }),
  items: many(purchaseItems),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  medicine: one(medicines, {
    fields: [purchaseItems.medicineId],
    references: [medicines.id],
  }),
}));
