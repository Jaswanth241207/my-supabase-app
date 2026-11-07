/** Mirror of the SQL transition rules in admin_set_order_status(); the database is authoritative. */
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
export const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']
export const FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed']

export const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}
export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => NEXT[from].includes(to)
/** Customers may cancel only before preparation starts. */
export const customerCanCancel = (s: OrderStatus): boolean => s === 'pending' || s === 'confirmed'
export const isActive = (s: OrderStatus): boolean => s !== 'completed' && s !== 'cancelled'
export const LABEL: Record<OrderStatus, string> = { pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready for pickup', completed: 'Completed', cancelled: 'Cancelled' }

export interface QueuedOrder { queueNo: number | null; status: OrderStatus; estPrepMinutes: number }
/** Position (1-based) among confirmed/preparing orders by queue number, plus a sequential wait estimate. */
export function queueInfo(target: QueuedOrder, all: QueuedOrder[]): { position: number; estMinutes: number } | null {
  if (target.status === 'ready') return { position: 0, estMinutes: 0 }
  if ((target.status !== 'confirmed' && target.status !== 'preparing') || target.queueNo == null) return null
  const ahead = all.filter((o) => (o.status === 'confirmed' || o.status === 'preparing') && o.queueNo != null && o.queueNo < target.queueNo!)
  return { position: ahead.length + 1, estMinutes: ahead.reduce((s, o) => s + o.estPrepMinutes, 0) + target.estPrepMinutes }
}
