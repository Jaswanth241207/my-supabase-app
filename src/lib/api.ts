import { supabase } from './supabase'
import { extFor } from './validation'

export type Row = Record<string, any>

const MESSAGES: Record<string, string> = {
  rate_limited: 'Too many attempts. Please wait and try again.', unauthorized: 'Please sign in again.', forbidden: 'You are not allowed to do that.',
  not_found: 'Not found, or you do not have access.', item_unavailable: 'An item in your cart is no longer available. Remove it and try again.',
  cart_empty: 'Your cart is empty.', canteen_closed: 'The canteen is currently closed for orders.', method_unavailable: 'That payment method is not available right now.',
  too_many_pending: 'You have too many unconfirmed orders. Wait for the canteen to confirm or cancel one.', invalid_transition: 'That change is not allowed for this order right now.',
  reason_required: 'Please provide a reason.', quantity_limit: 'You can order at most 20 of one item.', invalid_request: 'Invalid request.',
}
export function friendly(e: any): string {
  console.error('[BITEQ API Error]:', e)
  const m = String(e?.message ?? e?.error_description ?? e?.error ?? (typeof e === 'string' ? e : ''))
  const code = String(e?.code ?? '')
  if (code === '23505') return 'That already exists.'
  if (code === '23503') return 'This is still in use (for example, a category that has dishes). Remove the dependent items first.'
  if (code === '42501' || /row-level security|permission denied/i.test(m)) {
    return 'Permission denied: Please ensure your account has been promoted to admin in Supabase (run: select public.promote_admin(\'your-email\'); in Supabase SQL editor).'
  }
  if (/bucket not found|NoSuchBucket/i.test(m)) {
    return 'Storage bucket "food-images" not found. Please create a public bucket named "food-images" in your Supabase dashboard under Storage, or add the dish without an image.'
  }
  for (const k of Object.keys(MESSAGES)) if (m.includes(k)) return MESSAGES[k]
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Network problem. Check your connection and try again.'
  if (m && !/\[object Object\]/i.test(m) && m.length < 250) return m
  return 'Something went wrong. Please try again.'
}
async function rpc<T = any>(fn: string, args?: Row): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}
async function run<T = Row[]>(p: PromiseLike<{ data: any; error: any }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data as T
}

/* settings, menu */
export async function getSettings(): Promise<Row> {
  const rows = await run(supabase.from('settings').select('*'))
  return Object.fromEntries(rows.map((r: Row) => [r.key, r.value]))
}
export const listCategories = () => run(supabase.from('categories').select('*').order('sort_order').order('name'))
export const listFoods = () => run(supabase.from('food_items').select('*, category:categories(name,is_active)').order('name'))
export const getFood = (id: string) => run<Row>(supabase.from('food_items').select('*, category:categories(name)').eq('id', id).single())
export const popularItems = (limit = 5) => rpc<Row[]>('popular_items', { p_limit: limit })
export const imageUrl = (path?: string | null): string | null => (path ? supabase.storage.from('food-images').getPublicUrl(path).data.publicUrl : null)

/* cart */
export const getCart = () => run(supabase.from('cart_items').select('quantity, food:food_items(*)').order('updated_at'))
export const cartSet = (food: string, qty: number) => rpc('cart_set', { p_food: food, p_qty: qty })

/* orders */
export const sweepExpired = () => rpc('sweep_expired')
export const placeOrder = (method: 'cash' | 'online', notes: string, key: string) => rpc<string>('place_order', { p_method: method, p_notes: notes, p_key: key })
export async function listOrders() { await sweepExpired().catch(() => {}); return run(supabase.from('orders').select('*, items:order_items(name_snapshot, quantity)').order('created_at', { ascending: false }).limit(50)) }
export async function getOrder(id: string) {
  await sweepExpired().catch(() => {})
  const order = await run<Row>(supabase.from('orders').select('*, items:order_items(*), payment:payments(*)').eq('id', id).single())
  const q = await rpc<Row[]>('queue_info', { p_order: id }).catch(() => [])
  return { order, queue: q[0] ?? null }
}
export const cancelOrder = (id: string) => rpc('user_cancel_order', { p_order: id })
export const reorder = (id: string) => rpc<number>('reorder_to_cart', { p_order: id })
export function subscribeOrder(id: string | null, cb: () => void) {
  const ch = supabase.channel(`order-${id ?? 'all'}-${Math.random()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', ...(id ? { filter: `id=eq.${id}` } : {}) }, cb).subscribe()
  return () => { supabase.removeChannel(ch) }
}

/* notifications, profile */
export const listNotifications = () => run(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50))
export const countUnread = async (uid: string) => { const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('read_at', null); return count ?? 0 }
export const markRead = (id: string) => run(supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id))
export const markAllRead = (uid: string) => run(supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid).is('read_at', null))
export const updateProfile = (uid: string, v: { fullName: string; phone?: string }) => run(supabase.from('profiles').update({ full_name: v.fullName, phone: v.phone || null }).eq('id', uid))
export function subscribeNotifications(uid: string, cb: () => void) {
  const ch = supabase.channel(`notif-${uid}-${Math.random()}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, cb).subscribe()
  return () => { supabase.removeChannel(ch) }
}

/* admin (every call is re-checked by RLS / SECURITY DEFINER functions) */
export const adminStats = () => rpc<Row>('admin_stats')
export async function uploadFoodImage(file: File): Promise<string> {
  const path = `${crypto.randomUUID()}.${extFor(file.type)}`
  const { error } = await supabase.storage.from('food-images').upload(path, file, { contentType: file.type, upsert: false })
  if (error) {
    if (/bucket not found|NoSuchBucket/i.test(error.message || '')) {
      throw new Error('Storage bucket "food-images" not found. Please create a public bucket named "food-images" in your Supabase dashboard under Storage, or save the dish without an image.')
    }
    throw error
  }
  return path
}
export async function saveFood(id: string | null, v: Row, image?: File | null) {
  const imagePath = image ? await uploadFoodImage(image) : undefined
  const pieces = v.availablePieces !== undefined ? Number(v.availablePieces) : (v.available_pieces !== undefined ? Number(v.available_pieces) : 10)
  const row: Row = {
    name: v.name,
    category_id: v.categoryId,
    description: v.description ?? '',
    price: v.price,
    prep_minutes: v.prepMinutes,
    available_pieces: pieces,
    is_veg: !!v.isVeg,
    is_featured: !!v.isFeatured,
    is_available: v.isAvailable !== false && pieces > 0,
  }
  if (imagePath) row.image_path = imagePath

  try {
    return await run(id ? supabase.from('food_items').update(row).eq('id', id) : supabase.from('food_items').insert(row))
  } catch (err: any) {
    // If the remote database does not have the available_pieces column yet, gracefully retry without it
    if (err?.code === '42703' || /available_pieces/i.test(err?.message || '')) {
      const fallback = { ...row }
      delete fallback.available_pieces
      return await run(id ? supabase.from('food_items').update(fallback).eq('id', id) : supabase.from('food_items').insert(fallback))
    }
    throw err
  }
}
export const setFoodFlag = (id: string, patch: Row) => run(supabase.from('food_items').update(patch).eq('id', id))
export const deleteFood = (id: string) => run(supabase.from('food_items').delete().eq('id', id))
export const saveCategory = (id: string | null, v: Row) => run(id ? supabase.from('categories').update(v).eq('id', id) : supabase.from('categories').insert(v))
export const deleteCategory = (id: string) => run(supabase.from('categories').delete().eq('id', id))
export async function adminOrders(f: { status?: string; search?: string; from?: string; to?: string }, offset = 0, limit = 20) {
  await sweepExpired().catch(() => {})
  let q = supabase.from('orders').select('*, items:order_items(name_snapshot, quantity), customer:profiles(full_name, phone), payment:payments(status, method)').order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (f.status) q = q.eq('status', f.status)
  if (f.search && /^\d+$/.test(f.search.trim())) q = q.eq('order_no', Number(f.search.trim()))
  if (f.from) q = q.gte('created_at', new Date(f.from).toISOString())
  if (f.to) q = q.lte('created_at', new Date(f.to + 'T23:59:59').toISOString())
  return run(q)
}
export const adminQueue = async () => { await sweepExpired().catch(() => {}); return run(supabase.from('orders').select('*, items:order_items(name_snapshot, quantity), customer:profiles(full_name, phone)').in('status', ['confirmed', 'preparing', 'ready']).order('queue_no')) }
export const setOrderStatus = (id: string, status: string, reason?: string) => rpc('admin_set_order_status', { p_order: id, p_status: status, p_reason: reason ?? null })
export const adminUsers = (search: string, offset: number, limit = 20) => rpc<Row[]>('admin_list_users', { p_search: search, p_limit: limit, p_offset: offset })
export const setUserStatus = (user: string, status: 'active' | 'suspended', reason: string) => rpc('admin_set_user_status', { p_user: user, p_status: status, p_reason: reason })
export const adminAudit = (offset: number, limit = 25) => run(supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1))
export const saveSetting = (key: string, value: unknown) => run(supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }))
