import { NextResponse } from 'next/server';
import {
  getAllStores,
  createStore,
  updateStore,
  deleteStore,
  getStoreStats,
  getAllUsers,
  createUser,
  updateUserRole,
  updateUserStore,
  resetUserPassword,
  deleteUser
} from '@/app/admin/actions';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  try {
    if (action === 'getAllStores') return NextResponse.json(await getAllStores());
    if (action === 'getAllUsers') return NextResponse.json(await getAllUsers());
    if (action === 'getStoreStats') return NextResponse.json(await getStoreStats());
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    if (body.action === 'createStore') return NextResponse.json(await createStore(body.data));
    if (body.action === 'createUser') return NextResponse.json(await createUser(body.data));
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const body = await req.json();
  try {
    if (body.action === 'updateStore') return NextResponse.json(await updateStore(body.id, body.data));
    if (body.action === 'updateUserRole') return NextResponse.json(await updateUserRole(body.id, body.role));
    if (body.action === 'updateUserStore') return NextResponse.json(await updateUserStore(body.id, body.storeId));
    if (body.action === 'resetUserPassword') return NextResponse.json(await resetUserPassword(body.id, body.password));
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  
  try {
    if (action === 'deleteStore') return NextResponse.json(await deleteStore(id));
    if (action === 'deleteUser') return NextResponse.json(await deleteUser(id));
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
