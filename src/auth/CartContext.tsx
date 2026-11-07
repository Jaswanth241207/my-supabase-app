import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { cartSet, friendly, getCart, type Row } from '../lib/api'

interface CartCtx { lines: Row[]; count: number; loading: boolean; error: string; setQty: (foodId: string, qty: number) => Promise<void>; reload: () => Promise<void> }
const Ctx = createContext<CartCtx>({ lines: [], count: 0, loading: true, error: '', setQty: async () => {}, reload: async () => {} })
export const useCart = () => useContext(Ctx)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => { try { setLines(await getCart()); setError('') } catch (e) { setError(friendly(e)) } finally { setLoading(false) } }, [])
  useEffect(() => { reload() }, [reload])
  const setQty = async (foodId: string, qty: number) => { try { await cartSet(foodId, qty); setError(''); await reload() } catch (e) { setError(friendly(e)); throw e } }
  return <Ctx.Provider value={{ lines, count: lines.reduce((s, l) => s + l.quantity, 0), loading, error, setQty, reload }}>{children}</Ctx.Provider>
}
