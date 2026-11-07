import { describe, it, expect } from 'vitest'
import { computeBill, toPaise, formatINR } from '../src/lib/pricing'

describe('billing', () => {
  it('computes subtotal, 5% tax and total exactly', () => {
    const b = computeBill([{ price: 90, quantity: 2 }, { price: 15, quantity: 1 }], 5)
    expect(b.subtotal).toBe(195)
    expect(b.tax).toBe(9.75)
    expect(b.total).toBe(204.75)
  })
  it('avoids floating point drift', () => {
    expect(computeBill([{ price: 0.1, quantity: 3 }], 0).total).toBe(0.3)
    expect(toPaise(19.99)).toBe(1999)
  })
  it('rounds tax to the nearest paisa', () => {
    expect(computeBill([{ price: 33.33, quantity: 1 }], 5).tax).toBe(1.67)
  })
  it('caps discounts at the payable amount', () => {
    expect(computeBill([{ price: 10, quantity: 1 }], 0, 50).total).toBe(0)
  })
  it('handles an empty cart', () => {
    expect(computeBill([], 5).total).toBe(0)
  })
  it('formats rupees', () => {
    expect(formatINR(204.75).includes('204.75')).toBe(true)
  })
})
