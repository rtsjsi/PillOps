import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from './index';
import * as schema from './schema';
import { getSeedData } from '../lib/seed-data';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { DEFAULT_STORE } from '../lib/constants';

// Deterministic UUID namespace for seeding
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function toUUID(id: string): string {
  if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) return id;
  return uuidv5(id, NAMESPACE);
}

async function seed() {
  console.log('🌱 Starting Multi-tenant Seeding...');
  const data = getSeedData();

  try {
    // 1. Create a Demo Store
    console.log('Store: Creating "Angel Pharmacy"...');
    const [store] = await db.insert(schema.stores).values({
      id: toUUID('demo-store-1'),
      name: 'Angel Pharmacy',
      address: DEFAULT_STORE.storeAddress,
      phone: DEFAULT_STORE.storePhone,
      gstin: DEFAULT_STORE.gstin,
      lastInvoiceNumber: data.invoices.length,
      subscriptionTier: 'pro',
    }).onConflictDoNothing().returning();

    const storeId = store?.id || toUUID('demo-store-1');

    // 2. Insert Medicines
    console.log(`Medicines: Inserting ${data.medicines.length} items for store ${storeId}...`);
    for (const med of data.medicines) {
      const medId = toUUID(med.id);
      
      await db.insert(schema.medicines).values({
        id: medId,
        storeId: storeId,
        name: med.name,
        genericName: med.genericName,
        category: med.category as any,
        manufacturer: med.manufacturer,
        hsnCode: med.hsnCode,
        schedule: med.schedule as any,
        reorderLevel: med.reorderLevel,
        rack: med.rack,
        gstPercent: med.gstPercent,
        createdAt: new Date(med.createdAt),
        updatedAt: new Date(med.updatedAt),
      }).onConflictDoNothing();

      for (const batch of med.batches) {
        await db.insert(schema.batches).values({
          id: toUUID(batch.id),
          storeId: storeId,
          medicineId: medId,
          batchNumber: batch.batchNumber,
          quantity: batch.quantity,
          purchasePrice: batch.purchasePrice,
          mrp: batch.mrp,
          expiryDate: batch.expiryDate,
          receivedDate: batch.receivedDate,
        }).onConflictDoNothing();
      }
    }

    // 3. Insert Invoices
    console.log(`Invoices: Inserting ${data.invoices.length} items...`);
    for (const inv of data.invoices) {
      const invId = toUUID(inv.id);
      
      await db.insert(schema.invoices).values({
        id: invId,
        storeId: storeId,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        subtotal: inv.subtotal,
        gstAmount: inv.gstAmount,
        discountPercent: inv.discountPercent,
        discountAmount: inv.discountAmount,
        total: inv.total,
        createdAt: new Date(inv.createdAt),
      }).onConflictDoNothing();

      for (const item of inv.items) {
        await db.insert(schema.invoiceItems).values({
          id: uuidv4(),
          storeId: storeId,
          invoiceId: invId,
          medicineId: toUUID(item.medicineId),
          batchId: toUUID(item.batchId),
          quantity: item.quantity,
          mrp: item.mrp,
          gstPercent: item.gstPercent,
          expiryDate: item.expiryDate,
        }).onConflictDoNothing();
      }
    }

    console.log('✅ Multi-tenant Seeding completed successfully!');
    console.log('👉 Use Store ID:', storeId);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
