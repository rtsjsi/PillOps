import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

async function verifyAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const adminDb = createAdminClient();
  const { data: profile } = await adminDb
    .from('user_profiles')
    .select('store_id, role')
    .eq('id', user.id)
    .maybeSingle();
  
  if (!profile) throw new Error('Profile not found');
  if (profile.role !== 'owner' && profile.role !== 'super_admin') throw new Error('Forbidden');

  let storeId = profile.store_id;
  if (profile.role === 'super_admin') {
    const cookieStore = await cookies();
    storeId = cookieStore.get('pillops_selected_store_id')?.value ?? null;
    if (!storeId) {
      throw new Error('Super Admin must select a pharmacy from the top bar before managing staff.');
    }
  }

  if (!storeId) throw new Error('No store assigned');
  
  return { ...profile, store_id: storeId };
}

export async function GET() {
  try {
    const profile = await verifyAuth();
    const adminClient = createAdminClient();
    const { data } = await adminClient.from('user_profiles').select('*').eq('store_id', profile.store_id);
    return NextResponse.json(data || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await verifyAuth();
    const body = await req.json();
    const adminClient = createAdminClient();
    
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });
    if (authError) throw new Error(authError.message);
    
    await adminClient.from('user_profiles').insert({
      id: authUser.user.id,
      store_id: profile.store_id,
      role: body.role,
      full_name: body.fullName,
    });
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const profile = await verifyAuth();
    const body = await req.json();
    const adminClient = createAdminClient();
    
    await adminClient.from('user_profiles').update({ role: body.role }).eq('id', body.userId).eq('store_id', profile.store_id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const profile = await verifyAuth();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) throw new Error('userId required');
    
    const adminClient = createAdminClient();
    
    // Verify user belongs to same store
    const { data: target } = await adminClient.from('user_profiles').select('store_id').eq('id', userId).single();
    if (target?.store_id !== profile.store_id) throw new Error('Cannot delete this user');
    
    await adminClient.from('user_profiles').delete().eq('id', userId);
    await adminClient.auth.admin.deleteUser(userId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
