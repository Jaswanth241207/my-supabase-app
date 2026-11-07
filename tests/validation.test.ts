import { describe, it, expect } from 'vitest'
import { registerSchema, foodSchema, profileSchema, sniffType } from '../src/lib/validation'

describe('validation', () => {
  it('rejects weak passwords and invalid emails', () => {
    expect(registerSchema.safeParse({ fullName: 'Asha K', email: 'bad', password: 'short1' }).success).toBe(false)
    expect(registerSchema.safeParse({ fullName: 'Asha K', email: 'a@b.co', password: 'longenough1' }).success).toBe(true)
  })
  it('coerces food price and prep time and rejects negatives', () => {
    const base = { name: 'Samosa', categoryId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', description: '', prepMinutes: '5' }
    expect(foodSchema.parse({ ...base, price: '25' }).price).toBe(25)
    expect(foodSchema.parse({ ...base, price: '25', availablePieces: '15' }).availablePieces).toBe(15)
    expect(foodSchema.safeParse({ ...base, price: '-1' }).success).toBe(false)
    expect(foodSchema.safeParse({ ...base, price: '25', availablePieces: '-3' }).success).toBe(false)
  })
  it('validates phone numbers but allows blank', () => {
    expect(profileSchema.safeParse({ fullName: 'Ravi', phone: 'abc' }).success).toBe(false)
    expect(profileSchema.safeParse({ fullName: 'Ravi', phone: '' }).success).toBe(true)
  })
  it('detects image types from magic bytes', () => {
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg')
    expect(sniffType(new Uint8Array(12))).toBeNull()
  })
})
