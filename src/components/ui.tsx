import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Loader2, Utensils } from 'lucide-react'
import { imageUrl } from '../lib/api'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#EA580C" /><path d="M22 14v14a6 6 0 0 0 12 0V14M28 14v36M44 14c-5 4-6 12-6 18h6v18" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span className={light ? 'text-white' : 'text-stone-900'}>Bite<span className="text-brand-600">Q</span></span>
    </span>
  )
}
export function Spinner({ full = false }: { full?: boolean }) {
  return <div className={`flex items-center justify-center ${full ? 'min-h-[50vh]' : 'py-8'}`} role="status" aria-label="Loading"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
}
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="card text-center"><p className="font-semibold text-stone-900">{title}</p>{hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}{action && <div className="mt-3">{action}</div>}</div>
}
export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const c = { error: 'border-red-200 bg-red-50 text-red-800', success: 'border-green-200 bg-green-50 text-green-800', info: 'border-brand-200 bg-brand-50 text-stone-800' }[kind]
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>
}
export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-stone-900">{title}</h1>{sub && <p className="mt-1 text-sm text-stone-500">{sub}</p>}</div>{action}</div>
}
const BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-blue-100 text-blue-800', preparing: 'bg-brand-100 text-brand-700', ready: 'bg-green-100 text-green-800',
  completed: 'bg-stone-200 text-stone-700', cancelled: 'bg-red-100 text-red-700', paid: 'bg-green-100 text-green-800', refunded: 'bg-purple-100 text-purple-700',
  failed: 'bg-red-100 text-red-700', active: 'bg-green-100 text-green-800', suspended: 'bg-red-100 text-red-700',
}
export const Badge = ({ s, label }: { s: string; label?: string }) => <span className={`badge ${BADGE[s] ?? 'bg-stone-100 text-stone-700'}`}>{label ?? s.replace(/_/g, ' ')}</span>
export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return (<div><label className="block"><span className="label">{label}</span>{children}</label>{hint && !error && <p className="mt-1 text-xs text-stone-500">{hint}</p>}{error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}</div>)
}
export function ConfirmButton({ children, message, onConfirm, className = 'btn-secondary', disabled }: { children: ReactNode; message: string; onConfirm: () => void | Promise<void>; className?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => setOpen(true)}>{children}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" role="dialog" aria-modal="true">
          <div className="card max-w-sm"><p className="text-sm text-stone-900">{message}</p>
            <div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false); setOpen(false) } }}>Confirm</button></div></div>
        </div>
      )}
    </>
  )
}
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => { try { setData(await fn()); setError(null) } catch (e) { setError(e) } finally { setLoading(false) } }, deps)
  useEffect(() => { setLoading(true); reload() }, [reload])
  return { data, error, loading, reload }
}
export function FoodImage({ path, alt, className = 'h-40 w-full' }: { path?: string | null; alt: string; className?: string }) {
  const url = imageUrl(path)
  if (!url) return <div className={`${className} flex items-center justify-center rounded-xl bg-brand-50 text-brand-500`} aria-label={alt}><Utensils className="h-8 w-8" /></div>
  return <img src={url} alt={alt} loading="lazy" className={`${className} rounded-xl object-cover`} />
}
export const VegMark = ({ veg }: { veg: boolean }) => <span title={veg ? 'Vegetarian' : 'Non-vegetarian'} aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'} className={`inline-block h-4 w-4 rounded-sm border-2 p-[2px] ${veg ? 'border-leaf-600' : 'border-red-600'}`}><span className={`block h-full w-full rounded-full ${veg ? 'bg-leaf-600' : 'bg-red-600'}`} /></span>
export function Pager({ offset, size, count, onChange }: { offset: number; size: number; count: number; onChange: (o: number) => void }) {
  return (<div className="mt-4 flex items-center justify-between text-sm"><button className="btn-secondary" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - size))}>Previous</button><button className="btn-secondary" disabled={count < size} onClick={() => onChange(offset + size)}>Next</button></div>)
}
export const fmtDate = (d: string) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
