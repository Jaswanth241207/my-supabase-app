/** Billing maths in integer paise to avoid floating-point drift. The database recomputes the same values at checkout. */
export interface Line { price: number; quantity: number }
export interface Bill { subtotal: number; tax: number; discount: number; total: number }

export const toPaise = (rupees: number): number => Math.round(rupees * 100)
export const fromPaise = (paise: number): number => paise / 100

export function computeBill(lines: Line[], taxPercent: number, discount = 0): Bill {
  const sub = lines.reduce((s, l) => s + toPaise(l.price) * l.quantity, 0)
  const tax = Math.round((sub * taxPercent) / 100)
  const disc = Math.min(toPaise(discount), sub + tax)
  return { subtotal: fromPaise(sub), tax: fromPaise(tax), discount: fromPaise(disc), total: fromPaise(sub + tax - disc) }
}

export const formatINR = (n: number): string => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n)
