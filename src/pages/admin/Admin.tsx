import { useEffect, useState, type FormEvent } from 'react'
import { Route, Routes } from 'react-router-dom'
import * as api from '../../lib/api'
import { friendly, type Row } from '../../lib/api'
import { formatINR } from '../../lib/pricing'
import { LABEL, NEXT, type OrderStatus } from '../../lib/orderStatus'
import { categorySchema, foodSchema, validateImage, zodErrors } from '../../lib/validation'
import { Alert, Badge, ConfirmButton, Empty, Field, FoodImage, PageHeader, Pager, Spinner, VegMark, useAsync, fmtDate } from '../../components/ui'

/* ---------- Overview + canteen settings ---------- */
function SettingToggle({ k, label, value, onDone }: { k: string; label: string; value: boolean; onDone: () => void }) {
  return <label className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-orange-600" checked={value} onChange={async (e) => { await api.saveSetting(k, e.target.checked); onDone() }} /></label>
}
function SeatsField({ available, total, onDone }: { available: number; total: number; onDone: () => void }) {
  const [avail, setAvail] = useState(String(available))
  const [tot, setTot] = useState(String(total))
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    const a = parseInt(avail, 10)
    const t = parseInt(tot, 10)
    if (isNaN(a) || a < 0) return setMsg('Available seats must be 0 or more')
    if (isNaN(t) || t < 0) return setMsg('Total seats must be 0 or more')
    setBusy(true)
    try {
      await Promise.all([
        api.saveSetting('available_seats', a),
        api.saveSetting('total_seats', t),
        api.saveSetting('canteen_full', a === 0),
      ])
      setMsg('Saved!')
      setTimeout(() => setMsg(''), 2000)
      onDone()
    } catch {
      setMsg('Could not save')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="pt-1">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Available seats">
          <input className="input w-24" type="number" min="0" value={avail} onChange={(e) => setAvail(e.target.value)} />
        </Field>
        <Field label="Total capacity">
          <input className="input w-24" type="number" min="0" value={tot} onChange={(e) => setTot(e.target.value)} />
        </Field>
        <button className="btn-secondary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save seats'}</button>
        {msg && <span className="text-xs text-stone-500">{msg}</span>}
      </div>
    </div>
  )
}
function HoursField({ value, onDone }: { value: string; onDone: () => void }) {
  const [hours, setHours] = useState(value)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!hours.trim()) return setMsg('Please enter hours')
    setBusy(true)
    try {
      await api.saveSetting('canteen_hours', hours.trim())
      setMsg('Saved!')
      setTimeout(() => setMsg(''), 2000)
      onDone()
    } catch {
      setMsg('Could not save')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Canteen opening hours" hint="e.g. 8:00 AM - 8:00 PM">
        <input className="input w-56" value={hours} onChange={(e) => setHours(e.target.value)} />
      </Field>
      <button className="btn-secondary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save opening hours'}</button>
      {msg && <span className="text-xs text-stone-500">{msg}</span>}
    </div>
  )
}
function Overview() {
  const { data, loading, error, reload } = useAsync(async () => ({ stats: await api.adminStats(), settings: await api.getSettings() }))
  if (loading) return <Spinner full />
  if (error || !data) return <Alert>Could not load statistics.</Alert>
  const { stats: s, settings } = data
  const cards: Array<[string, string | number]> = [['Registered users', s.users], ['Total orders', s.orders_total], ["Today's orders", s.orders_today], ['Pending', s.pending], ['Preparing', s.preparing], ['Completed', s.completed], ['Cancelled', s.cancelled], ['Total sales', formatINR(Number(s.sales_total))], ['Revenue today', formatINR(Number(s.revenue_today))], ['Revenue (7 days)', formatINR(Number(s.revenue_week))], ['Revenue (30 days)', formatINR(Number(s.revenue_month))], ['In queue now', Number(s.confirmed) + Number(s.preparing) + Number(s.ready)]]
  return (
    <>
      <PageHeader title="Admin overview" sub="All figures come from the database. Revenue counts completed orders." />
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {cards.map(([l, v]) => (
          <div key={l} className="card p-4 transition-all duration-150 hover:shadow-md hover:border-brand-200">
            <p className="text-2xl font-bold text-stone-900">{v}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-stone-500">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold text-stone-900">Popular dishes</h2>
          {s.popular.length === 0 ? (
            <p className="text-sm text-stone-500">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {s.popular.map((p: Row) => (
                <li key={p.name} className="flex items-center justify-between py-2.5">
                  <span className="font-medium text-stone-800">{p.name}</span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{p.qty} sold</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card space-y-4">
          <h2 className="font-semibold text-stone-900">Canteen Status & Settings</h2>
          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Live Status & Seating</p>
            <SettingToggle k="canteen_open" label="Accepting orders (Kitchen open)" value={settings.canteen_open === true} onDone={reload} />
            <SettingToggle k="canteen_full" label="Canteen is Full (No seats vacant)" value={settings.canteen_full === true} onDone={reload} />
            <SeatsField available={Number(settings.available_seats ?? 25)} total={Number(settings.total_seats ?? 50)} onDone={reload} />
          </div>
          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Opening Hours</p>
            <HoursField value={String(settings.canteen_hours ?? '8:00 AM - 6:00 PM')} onDone={reload} />
          </div>
          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Payments & Taxes</p>
            <SettingToggle k="cash_enabled" label="Cash payment enabled" value={settings.cash_enabled === true} onDone={reload} />
            <TaxField value={Number(settings.tax_percent ?? 0)} onDone={reload} />
          </div>
        </div>
      </div>
    </>
  )
}
function TaxField({ value, onDone }: { value: number; onDone: () => void }) {
  const [v, setV] = useState(String(value))
  const [msg, setMsg] = useState('')
  return (<div className="flex items-end gap-2"><Field label="Tax percent"><input className="input w-24" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} /></Field>
    <button className="btn-secondary" onClick={async () => { const n = Number(v); if (!(n >= 0 && n <= 50)) return setMsg('0-50 only'); await api.saveSetting('tax_percent', n); setMsg('Saved'); onDone() }}>Save</button><span className="text-xs text-stone-500">{msg}</span></div>)
}

/* ---------- Orders ---------- */
function StatusActions({ o, onDone, setMsg }: { o: Row; onDone: () => void; setMsg: (m: string) => void }) {
  const next = NEXT[o.status as OrderStatus]
  const go = async (to: string, reason?: string) => { try { setMsg(''); await api.setOrderStatus(o.id, to, reason); onDone() } catch (e) { setMsg(friendly(e)) } }
  return (<div className="flex flex-wrap gap-2">{next.filter((n) => n !== 'cancelled').map((n) => <ConfirmButton key={n} className="btn-primary" message={`Mark order #${o.order_no} as ${LABEL[n]}?`} onConfirm={() => go(n)}>{LABEL[n]}</ConfirmButton>)}
    {next.includes('cancelled') && <button className="btn-danger" onClick={() => { const r = window.prompt(`Reason for cancelling order #${o.order_no}?`); if (r?.trim()) go('cancelled', r.trim()) }}>Cancel</button>}</div>)
}
function OrderCard({ o, onDone, setMsg }: { o: Row; onDone: () => void; setMsg: (m: string) => void }) {
  const pay = Array.isArray(o.payment) ? o.payment[0] : o.payment
  return (
    <div className="card p-4 transition duration-150 hover:border-brand-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-stone-900">#{o.order_no}</p>
            {o.queue_no ? <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">Queue #{o.queue_no}</span> : null}
          </div>
          <p className="mt-0.5 text-xs font-medium text-stone-500">
            {o.customer?.full_name}{o.customer?.phone ? ` · ${o.customer.phone}` : ''} · {fmtDate(o.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge s={o.status} label={LABEL[o.status as OrderStatus]} />
          {pay && <Badge s={pay.status} />}
          <span className="text-base font-bold text-stone-900">{formatINR(Number(o.total))}</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-stone-800">{o.items.map((i: Row) => `${i.quantity}x ${i.name_snapshot}`).join(', ')}</p>
      {o.notes && <p className="mt-1 text-xs italic text-stone-500 bg-stone-50 p-2 rounded-lg">Note: {o.notes}</p>}
      {o.cancel_reason && <p className="mt-1 text-xs font-semibold text-red-700 bg-red-50 p-2 rounded-lg">Cancelled: {o.cancel_reason}</p>}
      <div className="mt-4 pt-3 border-t border-stone-100"><StatusActions o={o} onDone={onDone} setMsg={setMsg} /></div>
    </div>
  )
}
function Orders() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [offset, setOffset] = useState(0)
  const [msg, setMsg] = useState('')
  const { data, loading, reload } = useAsync(() => api.adminOrders({ status, search, from, to }, offset), [status, search, from, to, offset])
  useEffect(() => api.subscribeOrder(null, reload), [reload])
  return (
    <>
      <PageHeader title="Orders" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <input className="input" placeholder="Search order number..." aria-label="Order number" value={search} onChange={(e) => { setOffset(0); setSearch(e.target.value) }} />
        <select className="input" aria-label="Status" value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value) }}><option value="">All statuses</option>{Object.keys(NEXT).map((s) => <option key={s} value={s}>{LABEL[s as OrderStatus]}</option>)}</select>
        <input type="date" className="input" aria-label="From date" value={from} onChange={(e) => { setOffset(0); setFrom(e.target.value) }} />
        <input type="date" className="input" aria-label="To date" value={to} onChange={(e) => { setOffset(0); setTo(e.target.value) }} />
        <button className="btn-secondary" onClick={() => { setStatus(''); setSearch(''); setFrom(''); setTo(''); setOffset(0) }}>Clear filters</button>
      </div>
      {msg && <div className="mb-3"><Alert>{msg}</Alert></div>}
      {loading ? <Spinner /> : !data?.length ? <Empty title="No orders match" /> : <div className="space-y-3">{data.map((o: Row) => <OrderCard key={o.id} o={o} onDone={reload} setMsg={setMsg} />)}</div>}
      <Pager offset={offset} size={20} count={data?.length ?? 0} onChange={setOffset} />
    </>
  )
}

/* ---------- Queue (FIFO by confirmed queue number) ---------- */
function Queue() {
  const { data, loading, reload } = useAsync(api.adminQueue)
  const [msg, setMsg] = useState('')
  useEffect(() => api.subscribeOrder(null, reload), [reload])
  return (
    <>
      <PageHeader title="Queue" sub="First in, first out. Queue numbers are assigned by the server when an order is confirmed." />
      {msg && <div className="mb-3"><Alert>{msg}</Alert></div>}
      {loading ? <Spinner /> : !data?.length ? <Empty title="The queue is empty" hint="Confirm pending orders on the Orders page to add them here." /> : <div className="space-y-3">{data.map((o: Row) => <OrderCard key={o.id} o={o} onDone={reload} setMsg={setMsg} />)}</div>}
    </>
  )
}

/* ---------- Foods ---------- */
function FoodForm({ food, cats, onDone, onCancel }: { food: Row | null; cats: Row[]; onDone: () => void; onCancel: () => void }) {
  const [err, setErr] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setMsg('')
    const fd = new FormData(e.currentTarget)
    const p = foodSchema.safeParse(Object.fromEntries(fd))
    if (!p.success) return setErr(zodErrors(p.error))
    const file = fd.get('image') as File | null
    if (file && file.size > 0) { const bad = await validateImage(file); if (bad) return setErr({ image: bad }) }
    setErr({}); setBusy(true)
    try { await api.saveFood(food?.id ?? null, { ...p.data, isVeg: fd.get('isVeg') === 'on', isFeatured: fd.get('isFeatured') === 'on', isAvailable: fd.get('isAvailable') === 'on' }, file && file.size > 0 ? file : null); onDone() } catch (ex) { setMsg(friendly(ex)) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="card mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" noValidate>
      <h2 className="font-semibold text-stone-900 sm:col-span-2 lg:col-span-3">{food ? 'Edit dish' : 'Add a dish'}</h2>
      {msg && <div className="sm:col-span-2 lg:col-span-3"><Alert>{msg}</Alert></div>}
      <Field label="Name" error={err.name}><input name="name" className="input" defaultValue={food?.name} /></Field>
      <Field label="Category" error={err.categoryId}><select name="categoryId" className="input" defaultValue={food?.category_id ?? ''}><option value="">Choose...</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Price (INR)" error={err.price}><input name="price" inputMode="decimal" className="input" defaultValue={food?.price} /></Field>
      <Field label="Available pieces (stock)" error={err.availablePieces} hint="Total pieces ready/available for orders"><input name="availablePieces" type="number" min="0" className="input" defaultValue={food?.available_pieces ?? 10} /></Field>
      <Field label="Preparation time (minutes)" error={err.prepMinutes}><input name="prepMinutes" inputMode="numeric" className="input" defaultValue={food?.prep_minutes ?? 10} /></Field>
      <Field label="Image (JPG/PNG/WebP, max 3 MB)" error={err.image}><input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="input" /></Field>
      <div className="sm:col-span-2 lg:col-span-3"><Field label="Description" error={err.description}><textarea name="description" rows={2} className="input" defaultValue={food?.description} /></Field></div>
      <div className="flex flex-wrap items-center gap-6 text-sm sm:col-span-2 lg:col-span-3">
        <label className="flex items-center gap-2 cursor-pointer font-medium"><input type="checkbox" name="isVeg" className="h-4 w-4 accent-green-600 rounded" defaultChecked={food?.is_veg ?? true} /> Vegetarian</label>
        <label className="flex items-center gap-2 cursor-pointer font-medium"><input type="checkbox" name="isFeatured" className="h-4 w-4 accent-orange-600 rounded" defaultChecked={food?.is_featured ?? false} /> Featured dish</label>
        <label className="flex items-center gap-2 cursor-pointer font-medium"><input type="checkbox" name="isAvailable" className="h-4 w-4 accent-orange-600 rounded" defaultChecked={food?.is_available ?? true} /> Available for order</label>
      </div>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3 pt-2">
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save dish'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
function Foods() {
  const { data, loading, reload } = useAsync(async () => ({ foods: await api.listFoods(), cats: await api.listCategories() }))
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [msg, setMsg] = useState('')
  if (loading) return <Spinner full />
  if (!data) return <Alert>Could not load dishes.</Alert>
  const guard = async (fn: () => Promise<unknown>) => { setMsg(''); try { await fn(); await reload() } catch (e) { setMsg(friendly(e)) } }
  return (
    <>
      <PageHeader title="Foods" sub="Changes appear instantly on the customer menu." action={<button className="btn-primary" onClick={() => setEditing('new')} disabled={data.cats.length === 0}>Add dish</button>} />
      {data.cats.length === 0 && <div className="mb-4"><Alert kind="info">Create a category first (Categories page).</Alert></div>}
      {msg && <div className="mb-3"><Alert>{msg}</Alert></div>}
      {editing && <FoodForm food={editing === 'new' ? null : editing} cats={data.cats} onDone={() => { setEditing(null); reload() }} onCancel={() => setEditing(null)} />}
      {data.foods.length === 0 ? <Empty title="No dishes yet" /> : (
        <div className="w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50/80 text-xs font-semibold uppercase tracking-wider text-stone-600">
                <tr>
                  <th className="py-3 px-4">Dish</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Pieces Available</th>
                  <th className="py-3 px-4">Prep</th>
                  <th className="py-3 px-4 text-center">Available</th>
                  <th className="py-3 px-4 text-center">Featured</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.foods.map((f: Row) => (
                  <tr key={f.id} className="transition hover:bg-stone-50/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <FoodImage path={f.image_path} alt={f.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                        <span className="flex items-center gap-2 font-medium text-stone-900"><VegMark veg={f.is_veg} />{f.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-stone-600">{f.category?.name}</td>
                    <td className="py-3 px-4 font-semibold text-stone-900">{formatINR(Number(f.price))}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold ${typeof f.available_pieces === 'number' && f.available_pieces <= 0 ? 'text-red-600' : 'text-stone-800'}`}>
                          {typeof f.available_pieces === 'number' ? `${f.available_pieces} pcs` : (f.is_available ? 'Available' : 'Unavailable')}
                        </span>
                        {typeof f.available_pieces === 'number' && f.available_pieces <= 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Out of stock</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-stone-600">{f.prep_minutes}m</td>
                    <td className="py-3 px-4 text-center">
                      <input type="checkbox" aria-label={`${f.name} available`} className="h-5 w-5 accent-orange-600 cursor-pointer" checked={f.is_available} onChange={() => guard(() => api.setFoodFlag(f.id, { is_available: !f.is_available }))} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input type="checkbox" aria-label={`${f.name} featured`} className="h-5 w-5 accent-orange-600 cursor-pointer" checked={f.is_featured} onChange={() => guard(() => api.setFoodFlag(f.id, { is_featured: !f.is_featured }))} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setEditing(f)}>Edit</button>
                      <ConfirmButton className="btn-danger px-3 py-1.5 text-xs" message={`Delete ${f.name}? Past orders keep their record.`} onConfirm={() => guard(() => api.deleteFood(f.id))}>Delete</ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------- Categories ---------- */
function Categories() {
  const { data, loading, reload } = useAsync(api.listCategories)
  const [err, setErr] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const guard = async (fn: () => Promise<unknown>) => { setMsg(''); try { await fn(); await reload() } catch (e) { setMsg(friendly(e)) } }
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget
    const p = categorySchema.safeParse(Object.fromEntries(new FormData(form)))
    if (!p.success) return setErr(zodErrors(p.error))
    setErr({}); await guard(async () => { await api.saveCategory(null, { name: p.data.name, description: p.data.description || null, sort_order: (data?.length ?? 0) + 1 }); form.reset() })
  }
  if (loading) return <Spinner full />
  return (
    <>
      <PageHeader title="Categories" />
      {msg && <div className="mb-3"><Alert>{msg}</Alert></div>}
      <form onSubmit={add} className="card mb-6 grid gap-4 sm:grid-cols-12 items-end" noValidate>
        <div className="sm:col-span-4"><Field label="Name" error={err.name}><input name="name" placeholder="Category name" className="input" /></Field></div>
        <div className="sm:col-span-6"><Field label="Description (optional)" error={err.description}><input name="description" placeholder="Brief description" className="input" /></Field></div>
        <div className="sm:col-span-2"><button className="btn-primary w-full">Add category</button></div>
      </form>
      {!data?.length ? <Empty title="No categories yet" /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c: Row) => (
            <div key={c.id} className="card flex flex-col justify-between gap-3 p-4">
              <div>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-stone-900">{c.name}</p>
                  {!c.is_active && <Badge s="cancelled" label="Hidden" />}
                </div>
                {c.description && <p className="mt-1 text-sm text-stone-500">{c.description}</p>}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => guard(() => api.saveCategory(c.id, { is_active: !c.is_active }))}>{c.is_active ? 'Hide' : 'Show'}</button>
                <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => { const n = window.prompt('Rename category', c.name); if (n?.trim()) guard(() => api.saveCategory(c.id, { name: n.trim() })) }}>Rename</button>
                <ConfirmButton className="btn-danger px-3 py-1.5 text-xs" message={`Delete ${c.name}? This fails if dishes still use it.`} onConfirm={() => guard(() => api.deleteCategory(c.id))}>Delete</ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ---------- Users ---------- */
function Users() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [msg, setMsg] = useState('')
  const { data, loading, reload } = useAsync(() => api.adminUsers(search, offset), [search, offset])
  const change = async (u: Row, status: 'active' | 'suspended') => {
    const reason = window.prompt(`Reason for ${status === 'suspended' ? 'suspending' : 'reactivating'} ${u.full_name}?`)
    if (!reason?.trim()) return
    try { await api.setUserStatus(u.id, status, reason.trim()); setMsg(''); await reload() } catch (e) { setMsg(friendly(e)) }
  }
  return (
    <>
      <PageHeader title="Users" />
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setOffset(0); setSearch(q) }}>
        <input className="input max-w-sm" placeholder="Search name or email..." aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-secondary">Search</button>
      </form>
      {msg && <div className="mb-3"><Alert>{msg}</Alert></div>}
      {loading ? <Spinner /> : (
        <div className="w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50/80 text-xs font-semibold uppercase tracking-wider text-stone-600">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Orders</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data?.map((u) => (
                  <tr key={u.id} className="transition hover:bg-stone-50/60">
                    <td className="py-3 px-4 font-medium text-stone-900">{u.full_name}</td>
                    <td className="py-3 px-4 text-stone-600">{u.email}</td>
                    <td className="py-3 px-4"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-stone-100 text-stone-700'}`}>{u.role}</span></td>
                    <td className="py-3 px-4 font-semibold text-stone-900">{u.order_count}</td>
                    <td className="py-3 px-4"><Badge s={u.status} /></td>
                    <td className="py-3 px-4 text-stone-500">{fmtDate(u.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      {u.role !== 'admin' && (u.status === 'active' ? (
                        <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => change(u, 'suspended')}>Suspend</button>
                      ) : (
                        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => change(u, 'active')}>Reactivate</button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pager offset={offset} size={20} count={data?.length ?? 0} onChange={setOffset} />
    </>
  )
}

export default function Admin() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="orders" element={<Orders />} />
      <Route path="queue" element={<Queue />} />
      <Route path="foods" element={<Foods />} />
      <Route path="categories" element={<Categories />} />
      <Route path="users" element={<Users />} />
    </Routes>
  )
}
