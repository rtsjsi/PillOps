'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// ─── Auth Guard ────────────────────────────────────────────

async function checkSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .eq('role', 'super_admin')
    .single();

  if (!profile && user.email !== 'admin@pillops.com') {
    throw new Error('Forbidden: Super Admin access required');
  }
  return user;
}

// ═══════════════════════════════════════════════════════════
// STORE MANAGEMENT
// ═══════════════════════════════════════════════════════════

export async function getAllStores() {
  try {
    await checkSuperAdmin();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('stores')
      .select('*, users:user_profiles(id)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const mapped = (data ?? []).map(store => ({
      ...store,
      userCount: store.users?.length ?? 0,
      users: undefined,
    }));
    return { data: mapped, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch stores' };
  }
}

export async function createStore(storeData: {
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  subscriptionTier?: string;
}) {
  await checkSuperAdmin();
  const supabase = createAdminClient();

  const { data: store, error } = await supabase
    .from('stores')
    .insert({
      name: storeData.name,
      address: storeData.address ?? '',
      phone: storeData.phone ?? '',
      gstin: storeData.gstin ?? '',
      subscription_tier: storeData.subscriptionTier ?? 'pro',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  return store;
}

export async function updateStore(
  storeId: string,
  storeData: {
    name?: string;
    address?: string;
    phone?: string;
    gstin?: string;
    subscriptionTier?: string;
  }
) {
  await checkSuperAdmin();
  const supabase = createAdminClient();

  const { data: updated, error } = await supabase
    .from('stores')
    .update({
      ...(storeData.name !== undefined && { name: storeData.name }),
      ...(storeData.address !== undefined && { address: storeData.address }),
      ...(storeData.phone !== undefined && { phone: storeData.phone }),
      ...(storeData.gstin !== undefined && { gstin: storeData.gstin }),
      ...(storeData.subscriptionTier !== undefined && { subscription_tier: storeData.subscriptionTier }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', storeId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  return updated;
}

export async function deleteStore(storeId: string) {
  await checkSuperAdmin();
  const supabase = createAdminClient();

  // Check if store has users
  const { count, error: countError } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId);

  if (countError) throw new Error(countError.message);

  if ((count ?? 0) > 0) {
    throw new Error(`Cannot delete store: ${count} user(s) are still assigned. Remove all users first.`);
  }

  const { error } = await supabase
    .from('stores')
    .delete()
    .eq('id', storeId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  return { success: true };
}

export async function getStoreStats() {
  try {
    await checkSuperAdmin();
    const supabase = createAdminClient();

    const [
      { count: totalStores },
      { count: totalUsers },
      { data: tierData },
    ] = await Promise.all([
      supabase.from('stores').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('stores').select('subscription_tier'),
    ]);

    const tierMap: Record<string, number> = {};
    for (const row of tierData ?? []) {
      const tier = row.subscription_tier ?? 'free';
      tierMap[tier] = (tierMap[tier] ?? 0) + 1;
    }

    return {
      data: {
        totalStores: totalStores ?? 0,
        totalUsers: totalUsers ?? 0,
        proStores: tierMap['pro'] ?? 0,
        enterpriseStores: tierMap['enterprise'] ?? 0,
        freeStores: tierMap['free'] ?? 0,
      },
      error: null
    };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch stats' };
  }
}

// ═══════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════

export async function getAllUsers() {
  try {
    await checkSuperAdmin();
    const adminClient = createAdminClient();

    const [{ data: profiles, error: profileError }, { data: authUsers }] = await Promise.all([
      adminClient
        .from('user_profiles')
        .select('*, store:stores(name)')
        .order('created_at', { ascending: false }),
      adminClient.auth.admin.listUsers(),
    ]);

    if (profileError) throw new Error(profileError.message);

    const authMap = new Map<string, { email: string; lastSignIn: string | null; created: string }>();
    if (authUsers?.users) {
      for (const u of authUsers.users) {
        authMap.set(u.id, {
          email: u.email ?? '',
          lastSignIn: u.last_sign_in_at ?? null,
          created: u.created_at,
        });
      }
    }

    const mapped = (profiles ?? []).map(profile => {
      const authData = authMap.get(profile.id);
      return {
        id: profile.id,
        fullName: profile.full_name ?? 'Unnamed User',
        role: profile.role ?? 'staff',
        storeId: profile.store_id,
        storeName: (profile.store as any)?.name ?? 'Unknown Store',
        email: authData?.email ?? 'N/A',
        lastSignIn: authData?.lastSignIn ?? null,
        authCreated: authData?.created ?? profile.created_at,
        createdAt: profile.created_at,
      };
    });
    return { data: mapped, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch users' };
  }
}

export async function createUser(userData: {
  email: string;
  password: string;
  fullName: string;
  role: string;
  storeId?: string;
}) {
  await checkSuperAdmin();
  const adminClient = createAdminClient();

  // Validate store exists if role is not super_admin or if storeId is provided
  let validStoreId = null;
  if (userData.role !== 'super_admin' || userData.storeId) {
    if (!userData.storeId) throw new Error('A store must be assigned for this role.');
    const { data: store, error: storeError } = await adminClient
      .from('stores')
      .select('id')
      .eq('id', userData.storeId)
      .single();

    if (storeError || !store) throw new Error('Selected store does not exist.');
    validStoreId = store.id;
  }

  // Create auth user via Supabase Admin API
  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true,
  });

  if (authError) throw new Error(`Failed to create auth user: ${authError.message}`);
  if (!authUser?.user) throw new Error('Auth user creation returned no user data.');

  // Create profile
  const { error: profileError } = await adminClient
    .from('user_profiles')
    .insert({
      id: authUser.user.id,
      store_id: validStoreId,
      role: userData.role,
      full_name: userData.fullName,
    });

  if (profileError) {
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

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('user_profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  return { success: true };
}

export async function updateUserStore(userId: string, newStoreId: string) {
  await checkSuperAdmin();
  const supabase = createAdminClient();

  // Verify store exists
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id')
    .eq('id', newStoreId)
    .single();

  if (storeError || !store) throw new Error('Target store does not exist.');

  const { error } = await supabase
    .from('user_profiles')
    .update({ store_id: newStoreId })
    .eq('id', userId);

  if (error) throw new Error(error.message);
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

  if (error) throw new Error(`Password reset failed: ${error.message}`);
  return { success: true };
}

export async function deleteUser(userId: string) {
  const currentUser = await checkSuperAdmin();

  if (currentUser.id === userId) {
    throw new Error('You cannot delete your own account.');
  }

  const adminClient = createAdminClient();

  // Delete profile first (FK cascade handles store refs)
  const { error: profileError } = await adminClient
    .from('user_profiles')
    .delete()
    .eq('id', userId);

  if (profileError) throw new Error(profileError.message);

  // Delete from Supabase Auth
  const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
  if (authError) {
    console.error('Warning: Auth user deletion failed:', authError.message);
  }

  revalidatePath('/admin');
  return { success: true };
}
