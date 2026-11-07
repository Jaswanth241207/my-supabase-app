import { describe, it, expect } from 'vitest'
import { canTransition, customerCanCancel, isActive, queueInfo, type QueuedOrder } from '../src/lib/orderStatus'

describe('order workflow', () => {
  it('allows only the forward path and cancellation', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true)
    expect(canTransition('pending', 'ready')).toBe(false)
    expect(canTransition('preparing', 'completed')).toBe(false)
    expect(canTransition('completed', 'cancelled')).toBe(false)
    expect(canTransition('cancelled', 'confirmed')).toBe(false)
  })
  it('lets customers cancel only before preparation', () => {
    expect(customerCanCancel('pending')).toBe(true)
    expect(customerCanCancel('confirmed')).toBe(true)
    expect(customerCanCancel('preparing')).toBe(false)
  })
  it('knows which orders are active', () => {
    expect(isActive('ready')).toBe(true)
    expect(isActive('completed')).toBe(false)
  })
})

describe('FIFO queue', () => {
  const o = (queueNo: number | null, status: QueuedOrder['status'], est = 10): QueuedOrder => ({ queueNo, status, estPrepMinutes: est })
  it('positions by confirmed queue number, ignoring finished orders', () => {
    const all = [o(1, 'completed'), o(2, 'preparing', 8), o(3, 'confirmed', 5), o(4, 'confirmed', 12), o(5, 'cancelled')]
    expect(queueInfo(all[3], all)).toEqual({ position: 3, estMinutes: 25 })
    expect(queueInfo(all[1], all)).toEqual({ position: 1, estMinutes: 8 })
  })
  it('has no position before confirmation and 0 when ready', () => {
    expect(queueInfo(o(null, 'pending'), [])).toBeNull()
    expect(queueInfo(o(7, 'ready'), [])).toEqual({ position: 0, estMinutes: 0 })
  })
})
