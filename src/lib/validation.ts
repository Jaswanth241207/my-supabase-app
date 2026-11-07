import { z, ZodError } from 'zod'

export const passwordSchema = z.string().min(10, 'Use at least 10 characters').max(72).regex(/[A-Za-z]/, 'Include a letter').regex(/[0-9]/, 'Include a number')
export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'At least 2 characters').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: passwordSchema,
})
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') })
export const emailSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email') })
export const newPasswordSchema = z.object({ password: passwordSchema })
export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'At least 2 characters').max(60),
  phone: z.string().trim().regex(/^[0-9+ -]{7,15}$/, 'Enter a valid phone number').optional().or(z.literal('')),
})
export const foodSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(80),
  categoryId: z.string().uuid('Choose a category'),
  description: z.string().trim().max(500).default(''),
  price: z.coerce.number().min(0, 'Price cannot be negative').max(100000),
  prepMinutes: z.coerce.number().int().min(1, 'At least 1 minute').max(180),
  availablePieces: z.coerce.number().int().min(0, 'Pieces cannot be negative').default(10),
})
export const categorySchema = z.object({ name: z.string().trim().min(2, 'At least 2 characters').max(40), description: z.string().trim().max(200).optional() })
export const checkoutSchema = z.object({ notes: z.string().trim().max(300).optional() })

export function zodErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (e instanceof ZodError) for (const i of e.issues) { const k = String(i.path[0] ?? '_'); if (!out[k]) out[k] = i.message }
  return out
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const IMAGE_MAX = 3 * 1024 * 1024
export function sniffType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp'
  return null
}
export async function validateImage(f: File): Promise<string | null> {
  if (!IMAGE_TYPES.includes(f.type)) return 'Use a JPG, PNG or WebP image'
  if (f.size > IMAGE_MAX) return 'Image must be 3 MB or smaller'
  const head = new Uint8Array(await f.slice(0, 12).arrayBuffer())
  return sniffType(head) === f.type ? null : 'File content does not match its type'
}
export const extFor = (t: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[t] ?? 'bin'
