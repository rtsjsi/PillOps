'use server';

import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// ─── Auth Guard ────────────────────────────────────────────

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
  return user;
}

// ═══════════════════════════════════════════════════════════
// STORE MANAGEMENT
// ═══════════════════════════════════════════════════════════

export async function getAllStores() {
  await checkSuperAdmin();

  const storesData = await db.query.stores.findMany({
    orderBy: [desc(schema.stores.createdAt)],
    with: {
      users: true,
    },
  });

  return storesData.map(store => ({
    ...store,
    userCount: store.users?.length || 0,
    users: undefined, // Don't leak full user data
  }));
}

export async function createStore(storeData: {
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  subscriptionTier?: string;
}) {
  await checkSuperAdmin();

  const [store] = await db.insert(schema.stores).values({
    name: storeData.name,
    address: storeData.address || '',
    phone: storeData.phone || '',
    gstin: storeData.gstin || '',
    subscriptionTier: storeData.subscriptionTier || 'pro',
  }).returning();

  revalidatePath('/admin');
  return store;
}

export async function updateStore(storeId: string, storeData: {
  name?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  subscriptionTier?: string;
}) {
  await checkSuperAdmin();

  const [updated] = await db.update(schema.stores)
    .set({
      ...storeData,
      updatedAt: new Date(),
    })
    .where(eq(schema.stores.id, storeId))
    .returning();

  revalidatePath('/admin');
  return updated;
}

export async function deleteStore(storeId: string) {
  await checkSuperAdmin();

  // Check if store has users
  const users = await db.query.userProfiles.findMany({
    where: eq(schema.userProfiles.storeId, storeId),
  });

  if (users.length > 0) {
    throw new Error(`Cannot delete store: ${users.length} user(s) are still assigned. Remove all users first.`);
  }

  await db.delete(schema.stores).where(eq(schema.stores.id, storeId));
  revalidatePath('/admin');
  return { success: true };
}

export async function getStoreStats() {
  await checkSuperAdmin();

  const [totalStores] = await db.select({ count: sql`count(*)` }).from(schema.stores);
  const [totalUsers] = await db.select({ count: sql`count(*)` }).from(schema.userProfiles);

  const tierCounts = await db.select({
    tier: schema.stores.subscriptionTier,
    count: sql<number>`count(*)`,
  })
    .from(schema.stores)
    .groupBy(schema.stores.subscriptionTier);

  const tierMap: Record<string, number> = {};
  for (const t of tierCounts) {
    tierMap[t.tier || 'free'] = Number(t.count);
  }

  return {
    totalStores: Number(totalStores.count),
    totalUsers: Number(totalUsers.count),
    proStores: tierMap['pro'] || 0,
    enterpriseStores: tierMap['enterprise'] || 0,
    freeStores: tierMap['free'] || 0,
  };
}

// ═══════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════

export async function getAllUsers() {
  await checkSuperAdmin();

  const users = await db.query.userProfiles.findMany({
    orderBy: [desc(schema.userProfiles.createdAt)],
    with: {
      store: true,
    },
  });

  // Get email addresses from Supabase Auth
  const adminClient = createAdminClient();
  const { data: authUsers } = await adminClient.auth.admin.listUsers();

  const authMap = new Map<string, { email: string; lastSignIn: string | null; created: string }>();
  if (authUsers?.users) {
    for (const u of authUsers.users) {
      authMap.set(u.id, {
        email: u.email || '',
        lastSignIn: u.last_sign_in_at || null,
        created: u.created_at,
      });
    }
  }

  return users.map(profile => {
    const authData = authMap.get(profile.id);
    return {
      id: profile.id,
      fullName: profile.fullName || 'Unnamed User',
      role: profile.role || 'staff',
      storeId: profile.storeId,
      storeName: profile.store?.name || 'Unknown Store',
      email: authData?.email || 'N/A',
      lastSignIn: authData?.lastSignIn || null,
      authCreated: authData?.created || profile.createdAt?.toISOString(),
      createdAt: profile.createdAt?.toISOString(),
    };
  });
}

export async function createUser(userData: {
  email: string;
  password: string;
  fullName: string;
  role: string;
  storeId: string;
}) {
  await checkSuperAdmin();

  // Validate store exists
  const store = await db.query.stores.findFirst({
    where: eq(schema.stores.id, userData.storeId),
  });
  if (!store) throw new Error('Selected store does not exist.');

  // Create auth user via Supabase Admin API
  const adminClient = createAdminClient();
  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true, // Auto-confirm email
  });

  if (authError) {
    throw new Error(`Failed to create auth user: ${authError.message}`);
  }

  if (!authUser?.user) {
    throw new Error('Auth user creation returned no user data.');
  }

  // Create profile in user_profiles table
  try {
    await db.insert(schema.userProfiles).values({
      id: authUser.user.id,
      storeId: userData.storeId,
      role: userData.role,
      fullName: userData.fullName,
    });
  } catch (profileError: any) {
    // Rollback: delete the auth user if profile creation fails
    await adminClient.auth.admin.deleteUser(authUser.user.id);
    throw new Error(`Failed to create user profile: ${profileError.message}`);
  }

  revalidatePath('/admin');
  return { id: authUser.user.id, email: authUser.user.email };
}

export async function updateUserRole(userId: string, newRole: string) {
  await checkSuperAdmin();

  const validRoles = ['super_admin', 'owner', 'staff'];
  if (!validRoles.includes(newRole)) {
    throw new Error(`Invalid role: ${newRole}. Must be one of: ${validRoles.join(', ')}`);
  }

  await db.update(schema.userProfiles)
    .set({ role: newRole })
    .where(eq(schema.userProfiles.id, userId));

  revalidatePath('/admin');
  return { success: true };
}

export async function updateUserStore(userId: string, newStoreId: string) {
  await checkSuperAdmin();

  // Verify store exists
  const store = await db.query.stores.findFirst({
    where: eq(schema.stores.id, newStoreId),
  });
  if (!store) throw new Error('Target store does not exist.');

  await db.update(schema.userProfiles)
    .set({ storeId: newStoreId })
    .where(eq(schema.userProfiles.id, userId));

  revalidatePath('/admin');
  return { success: true };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  await checkSuperAdmin();

  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    throw new Error(`Password reset failed: ${error.message}`);
  }

  return { success: true };
}

export async function deleteUser(userId: string) {
  const currentUser = await checkSuperAdmin();

  if (currentUser.id === userId) {
    throw new Error('You cannot delete your own account.');
  }

  // Delete profile first (cascading from schema handles store refs)
  await db.delete(schema.userProfiles).where(eq(schema.userProfiles.id, userId));

  // Delete from Supabase Auth
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    console.error('Warning: Auth user deletion failed:', error.message);
    // Profile is already deleted, so we continue
  }

  revalidatePath('/admin');
  return { success: true };
}
