'use server';

import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, desc, sql, and, gt } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

// ─── SaaS Helpers ──────────────────────────────────────────

async function getStoreId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.id, user.id),
  });

  if (!profile) throw new Error('Store profile not found');
  
  // Super admin doesn't strictly belong to one store, but for regular actions, 
  // they can be assigned to a "system" store or we handle them specially.
  return profile.storeId;
}

async function checkSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const profile = await db.query.userProfiles.findFirst({
    where: and(
      eq(schema.userProfiles.id, user.id),
      eq(schema.userProfiles.role, 'super_admin')
    ),
  });

  if (!profile) throw new Error('Forbidden: Super Admin access required');
  return true;
}

// ─── Super Admin Actions ───────────────────────────────────

export async function createStore(storeData: any) {
  await checkSuperAdmin();
  
  const [store] = await db.insert(schema.stores).values({
    name: storeData.name,
    address: storeData.address,
    phone: storeData.phone,
    gstin: storeData.gstin,
    subscriptionTier: storeData.subscriptionTier || 'pro',
  }).returning();

  revalidatePath('/admin');
  return store;
}

export async function getAllStores() {
  await checkSuperAdmin();
  return await db.query.stores.findMany({
    orderBy: [desc(schema.stores.createdAt)],
  });
}

// ─── Dashboard Stats ──────────────────────────────────────

export async function getDashboardStats() {
  const storeId = await getStoreId();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalMedicines] = await db.select({ count: sql`count(*)` })
    .from(schema.medicines)
    .where(eq(schema.medicines.storeId, storeId));

  const [totalSalesToday] = await db.select({ sum: sql`sum(total)` })
    .from(schema.invoices)
    .where(and(
        eq(schema.invoices.storeId, storeId),
        gt(schema.invoices.createdAt, today)
    ));
  
  const [lowStock] = await db.select({ count: sql`count(*)` })
    .from(schema.medicines)
    .where(and(
        eq(schema.medicines.storeId, storeId),
        sql`${schema.medicines.reorderLevel} >= (SELECT COALESCE(sum(quantity), 0) FROM ${schema.batches} WHERE ${schema.batches.medicineId} = ${schema.medicines.id})`
    ));

  const [expiringSoon] = await db.select({ count: sql`count(*)` })
    .from(schema.batches)
    .where(and(
        eq(schema.batches.storeId, storeId),
        gt(schema.batches.quantity, 0),
        sql`to_date(${schema.batches.expiryDate}, 'YYYY-MM') <= (CURRENT_DATE + INTERVAL '3 months')`
    ));

  const recentInvoices = await db.query.invoices.findMany({
    where: eq(schema.invoices.storeId, storeId),
    limit: 5,
    orderBy: [desc(schema.invoices.createdAt)],
  });

  const [storeInfo] = await db.select().from(schema.stores).where(eq(schema.stores.id, storeId)).limit(1);

  return {
    totalMedicines: Number(totalMedicines.count),
    todaySales: Number(totalSalesToday.sum || 0),
    lowStockCount: Number(lowStock.count),
    expiringCount: Number(expiringSoon.count),
    recentInvoices,
    storeName: storeInfo?.name || 'PillOps Store',
  };
}

// ─── Medicines ─────────────────────────────────────────────

export async function getMedicines() {
  const storeId = await getStoreId();
  return await db.query.medicines.findMany({
    where: eq(schema.medicines.storeId, storeId),
    with: {
      batches: true,
    },
    orderBy: [schema.medicines.name],
  });
}

export async function getMedicineById(id: string) {
  const storeId = await getStoreId();
  return await db.query.medicines.findFirst({
    where: and(
        eq(schema.medicines.id, id),
        eq(schema.medicines.storeId, storeId)
    ),
    with: {
      batches: true,
    },
  });
}

// ─── Sales / POS ───────────────────────────────────────────

export async function createInvoice(invoiceData: any, items: any[]) {
  const storeId = await getStoreId();

  return await db.transaction(async (tx) => {
    // 1. Insert Invoice
    const [invoice] = await tx.insert(schema.invoices).values({
      ...invoiceData,
      storeId,
    }).returning();

    // 2. Insert Items and Update Stock
    for (const item of items) {
      await tx.insert(schema.invoiceItems).values({
        invoiceId: invoice.id,
        storeId,
        medicineId: item.medicineId,
        batchId: item.batchId,
        quantity: item.quantity,
        mrp: item.mrp,
        gstPercent: item.gstPercent,
        expiryDate: item.expiryDate,
      });

      // Update batch quantity
      await tx.update(schema.batches)
        .set({ quantity: sql`${schema.batches.quantity} - ${item.quantity}` })
        .where(and(
            eq(schema.batches.id, item.batchId),
            eq(schema.batches.storeId, storeId)
        ));
    }

    // 3. Update Store Settings (Last Invoice Number)
    await tx.update(schema.stores)
      .set({ lastInvoiceNumber: sql`${schema.stores.lastInvoiceNumber} + 1` })
      .where(eq(schema.stores.id, storeId));

    revalidatePath('/dashboard');
    revalidatePath('/inventory');
    revalidatePath('/pos');
    return invoice;
  });
}

export async function getInvoiceById(id: string) {
  const storeId = await getStoreId();
  return await db.query.invoices.findFirst({
    where: and(
        eq(schema.invoices.id, id),
        eq(schema.invoices.storeId, storeId)
    ),
    with: {
      items: true,
    },
  });
}

export async function getInvoices() {
  const storeId = await getStoreId();
  return await db.query.invoices.findMany({
    where: eq(schema.invoices.storeId, storeId),
    with: {
      items: true,
    },
    orderBy: [desc(schema.invoices.createdAt)],
  });
}

export async function getStoreSettings() {
  const storeId = await getStoreId();
  const [settings] = await db.select().from(schema.stores).where(eq(schema.stores.id, storeId)).limit(1);
  return settings;
}

// ─── Purchases ─────────────────────────────────────────────

export async function getPurchases() {
  const storeId = await getStoreId();
  return await db.query.purchases.findMany({
    where: eq(schema.purchases.storeId, storeId),
    orderBy: [desc(schema.purchases.createdAt)],
  });
}

export async function savePurchaseInvoice(purchaseData: any, items: any[]) {
  const storeId = await getStoreId();
  
  return await db.transaction(async (tx) => {
    // 1. Insert Purchase Record
    const [purchase] = await tx.insert(schema.purchases).values({
      ...purchaseData,
      storeId,
    }).returning();

    // 2. Insert Items and Update/Insert Medicines & Batches
    for (const item of items) {
      // Find medicine by name
      let med = await tx.query.medicines.findFirst({
        where: and(
            eq(schema.medicines.name, item.medicineName),
            eq(schema.medicines.storeId, storeId)
        ),
      });

      if (!med) {
        // Create new medicine if doesn't exist
        [med] = await tx.insert(schema.medicines).values({
          storeId,
          name: item.medicineName,
          genericName: '',
          category: 'Tablet',
          manufacturer: item.manufacturer || '',
          hsnCode: item.hsnCode || '',
        }).returning();
      }

      await tx.insert(schema.purchaseItems).values({
        storeId,
        purchaseId: purchase.id,
        medicineId: med.id,
        medicineName: item.medicineName,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
        freeQuantity: item.freeQuantity || 0,
        purchasePrice: item.purchasePrice,
        discountPercent: item.discountPercent || 0,
        mrp: item.mrp,
        gstPercent: item.gstPercent,
        expiryDate: item.expiryDate,
        totalAmount: item.totalAmount,
      });

      // Insert or Update Batch
      const existingBatch = await tx.query.batches.findFirst({
        where: and(
            eq(schema.batches.storeId, storeId),
            eq(schema.batches.medicineId, med.id),
            eq(schema.batches.batchNumber, item.batchNumber)
        ),
      });

      if (existingBatch) {
        await tx.update(schema.batches)
          .set({ quantity: sql`${schema.batches.quantity} + ${item.quantity + (item.freeQuantity || 0)}` })
          .where(and(
            eq(schema.batches.id, existingBatch.id),
            eq(schema.batches.storeId, storeId)
          ));
      } else {
        await tx.insert(schema.batches).values({
          storeId,
          medicineId: med.id,
          batchNumber: item.batchNumber,
          quantity: item.quantity + (item.freeQuantity || 0),
          purchasePrice: item.purchasePrice,
          mrp: item.mrp,
          expiryDate: item.expiryDate,
          receivedDate: purchaseData.invoiceDate,
        });
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/inventory');
    revalidatePath('/purchases');
    return purchase;
  });
}
