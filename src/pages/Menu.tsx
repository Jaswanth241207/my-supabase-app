import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Clock, Minus, Plus, Users } from 'lucide-react'
import { useCart } from '../auth/CartContext'
import { getFood, getSettings, listCategories, listFoods, type Row } from '../lib/api'
import { formatINR } from '../lib/pricing'
import { Alert, Badge, Empty, FoodImage, PageHeader, Spinner, VegMark, useAsync } from '../components/ui'

function Stepper({ food }: { food: Row }) {
  const { lines, setQty } = useCart()
  const [err, setErr] = useState('')
  const qty = lines.find((l) => l.food.id === food.id)?.quantity ?? 0
  const pieces = typeof food.available_pieces === 'number' ? food.available_pieces : 10
  const maxAllowed = Math.min(20, Math.max(0, pieces))
  const isOutOfStock = !food.is_available || pieces <= 0
  const set = async (n: number) => {
    if (n > pieces) {
      setErr(`Only ${pieces} pieces available.`)
      return
    }
    try { setErr(''); await setQty(food.id, n) } catch { setErr('Could not update the cart.') }
  }
  if (isOutOfStock) return <button className="btn-secondary w-full opacity-60" disabled>{pieces <= 0 ? 'Out of stock' : 'Unavailable'}</button>
  if (qty === 0) return <><button className="btn-primary w-full" onClick={() => set(1)}>Add to cart</button>{err && <p className="mt-1 text-xs text-red-600">{err}</p>}</>
  return (<><div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-2 py-1">
    <button className="rounded-lg p-2 hover:bg-brand-100" aria-label={`Decrease ${food.name}`} onClick={() => set(qty - 1)}><Minus className="h-4 w-4" /></button>
    <span className="font-semibold" aria-live="polite">{qty}</span>
    <button className="rounded-lg p-2 hover:bg-brand-100" aria-label={`Increase ${food.name}`} disabled={qty >= maxAllowed} onClick={() => set(qty + 1)}><Plus className="h-4 w-4" /></button></div>
    {qty >= maxAllowed && pieces < 20 && <p className="mt-1 text-[11px] text-amber-700 font-medium">Max available reached ({pieces} pcs)</p>}
    {err && <p className="mt-1 text-xs text-red-600">{err}</p>}</>)
}

export function MenuPage() {
  const [sp, setSp] = useSearchParams()
  const { data, loading, error } = useAsync(async () => {
    const [foods, cats, settings] = await Promise.all([listFoods(), listCategories(), getSettings()])
    return { foods, cats, settings }
  })
  const [q, setQ] = useState('')
  const [veg, setVeg] = useState<'all' | 'veg' | 'nonveg'>('all')
  const [sort, setSort] = useState('name')
  const cat = sp.get('category') ?? ''
  const shown = useMemo(() => {
    let list = (data?.foods ?? []).filter((f) => f.category?.is_active !== false)
    if (cat) list = list.filter((f) => f.category_id === cat)
    if (q.trim()) list = list.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()))
    if (veg !== 'all') list = list.filter((f) => f.is_veg === (veg === 'veg'))
    return [...list].sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : a.name.localeCompare(b.name))
  }, [data, cat, q, veg, sort])
  if (loading) return <Spinner full />
  if (error || !data) return <Alert>Could not load the menu.</Alert>

  const isFull = data.settings.canteen_full === true || Number(data.settings.available_seats ?? 1) <= 0
  const availSeats = Number(data.settings.available_seats ?? 25)
  const hours = String(data.settings.canteen_hours ?? '8:00 AM - 6:00 PM')
  const open = data.settings.canteen_open === true

  return (
    <>
      <PageHeader
        title="Menu"
        sub="Fresh from the canteen"
        action={
          <span className={`badge ${open ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
            {open ? 'Accepting orders' : 'Kitchen closed'}
          </span>
        }
      />

      {/* Canteen live status & seating indicator */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isFull ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
            <span className={`h-2 w-2 rounded-full ${isFull ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
            <Users className="h-3.5 w-3.5" />
            {isFull ? 'Canteen is Full (0 seats)' : `${availSeats} seats available`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <Clock className="h-3.5 w-3.5 text-stone-500" />
          <span>Opening hours: <strong className="text-stone-800">{hours}</strong></span>
        </div>
        <div className="ml-auto text-xs text-stone-500">
          {isFull ? 'Dining area full - takeaway available' : 'Seats vacant for dining in'}
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <input className="input md:col-span-2" placeholder="Search dishes" aria-label="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" aria-label="Diet" value={veg} onChange={(e) => setVeg(e.target.value as any)}><option value="all">Veg and non-veg</option><option value="veg">Vegetarian</option><option value="nonveg">Non-vegetarian</option></select>
        <select className="input" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Sort: name</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select>
      </div>
      <div className="mb-6 flex flex-wrap gap-2"><button className={cat === '' ? 'btn-primary' : 'btn-secondary'} onClick={() => setSp({})}>All</button>{data.cats.map((c) => <button key={c.id} className={cat === c.id ? 'btn-primary' : 'btn-secondary'} onClick={() => setSp({ category: c.id })}>{c.name}</button>)}</div>
      {shown.length === 0 ? <Empty title="No dishes found" hint="Try a different search or filter." /> : (
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">{shown.map((f) => (
          <div key={f.id} className={`card flex flex-col justify-between p-3.5 hover:border-brand-300 hover:shadow-md transition-all duration-200 ${f.is_available && Number(f.available_pieces ?? 1) > 0 ? '' : 'opacity-75'}`}>
            <div>
              <Link to={`/app/menu/${f.id}`} className="block overflow-hidden rounded-xl"><FoodImage path={f.image_path} alt={f.name} className="h-40 w-full object-cover hover:scale-105 transition-transform duration-300" /></Link>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div>
                  <Link to={`/app/menu/${f.id}`} className="flex items-center gap-2 font-semibold text-stone-900 hover:text-brand-700 transition-colors">
                    <VegMark veg={f.is_veg} />{f.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-stone-500">{f.description}</p>
                </div>
                <p className="font-bold text-stone-900 shrink-0">{formatINR(Number(f.price))}</p>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 text-stone-500"><Clock className="h-3.5 w-3.5" />{f.prep_minutes} min</span>
                {typeof f.available_pieces === 'number' ? (
                  f.available_pieces > 0 ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                      {f.available_pieces} {f.available_pieces === 1 ? 'pc' : 'pcs'} available
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                      Out of stock (0 pcs)
                    </span>
                  )
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    In stock
                  </span>
                )}
                {!f.is_available && <Badge s="cancelled" label="Unavailable" />}
              </div>
            </div>
            <div className="mt-3.5 pt-2 border-t border-stone-100"><Stepper food={f} /></div>
          </div>))}</div>)}
    </>
  )
}

export function FoodDetail() {
  const { id = '' } = useParams()
  const { data: f, loading, error } = useAsync(() => getFood(id), [id])
  if (loading) return <Spinner full />
  if (error || !f) return <Alert>Dish not found.</Alert>
  const pieces = typeof f.available_pieces === 'number' ? f.available_pieces : 10
  return (
    <div className="card p-6 md:p-8 grid gap-8 lg:grid-cols-12 items-start">
      <div className="lg:col-span-5 xl:col-span-5">
        <FoodImage path={f.image_path} alt={f.name} className="h-72 w-full md:h-96 object-cover rounded-2xl shadow-sm" />
      </div>
      <div className="lg:col-span-7 xl:col-span-7">
        <p className="text-sm text-stone-500">{f.category?.name}</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold text-stone-900"><VegMark veg={f.is_veg} />{f.name}</h1>
        <p className="mt-3 text-stone-600">{f.description || 'No description yet.'}</p>
        <p className="mt-4 text-2xl font-bold text-stone-900">{formatINR(Number(f.price))}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-600">
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />About {f.prep_minutes} min</span>
          {typeof f.available_pieces === 'number' ? (
            pieces > 0 ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                {pieces} pieces available
              </span>
            ) : (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                Out of stock (0 pieces left)
              </span>
            )
          ) : (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              In stock
            </span>
          )}
          <Badge s={f.is_available && pieces > 0 ? 'active' : 'cancelled'} label={f.is_available && pieces > 0 ? 'Available' : 'Unavailable'} />
        </div>
        <div className="mt-6 max-w-xs"><Stepper food={f} /></div>
        <Link to="/app/cart" className="mt-4 inline-block text-sm text-brand-700 underline">Go to cart</Link>
      </div>
    </div>
  )
}
