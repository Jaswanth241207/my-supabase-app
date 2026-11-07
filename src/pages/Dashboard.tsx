import { Link } from 'react-router-dom'
import { Clock, Coffee, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { getSettings, listCategories, listFoods, listOrders, popularItems } from '../lib/api'
import { formatINR } from '../lib/pricing'
import { isActive, LABEL, type OrderStatus } from '../lib/orderStatus'
import { Alert, Badge, Empty, FoodImage, PageHeader, Spinner, VegMark, useAsync, fmtDate } from '../components/ui'

export default function Dashboard() {
  const { profile } = useAuth()
  const { data, loading, error } = useAsync(async () => {
    const [settings, cats, foods, orders, popular] = await Promise.all([getSettings(), listCategories(), listFoods(), listOrders(), popularItems(5)])
    return { settings, cats, foods, orders, popular }
  })
  if (loading) return <Spinner full />
  if (error || !data) return <Alert>Could not load your dashboard.</Alert>
  const { settings, cats, foods, orders, popular } = data
  const live = orders.filter((o: any) => isActive(o.status as OrderStatus))
  const featured = foods.filter((f: any) => f.is_featured && f.is_available).slice(0, 6)
  const open = settings.canteen_open === true
  const isFull = settings.canteen_full === true || Number(settings.available_seats ?? 1) <= 0
  const availSeats = Number(settings.available_seats ?? 25)
  const totalSeats = Number(settings.total_seats ?? 50)
  const hours = String(settings.canteen_hours ?? '8:00 AM - 6:00 PM')
  return (
    <>
      <PageHeader
        title={`Hello, ${profile?.full_name ?? ''}`}
        sub={`Canteen hours: ${hours}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${isFull ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {isFull ? 'Canteen is Full' : `${availSeats} seats free`}
            </span>
            <span className={`badge ${open ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
              {open ? 'Canteen open for orders' : 'Canteen closed'}
            </span>
          </div>
        }
      />

      {/* Live Canteen Status Banner */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="grid divide-y divide-stone-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3 p-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isFull ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Seating Status</p>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${isFull ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                <p className={`text-base font-bold ${isFull ? 'text-red-600' : 'text-emerald-700'}`}>
                  {isFull ? 'Canteen is Full' : `${availSeats} seats available`}
                </p>
              </div>
              <p className="text-xs text-stone-500">{isFull ? '0 seats available right now' : `out of ${totalSeats} total seats`}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Opening Hours</p>
              <p className="text-base font-bold text-stone-900">{hours}</p>
              <p className="text-xs text-stone-500">Daily canteen schedule</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${open ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Online Ordering</p>
              <p className={`text-base font-bold ${open ? 'text-emerald-700' : 'text-amber-700'}`}>
                {open ? 'Accepting Orders' : 'Orders Paused'}
              </p>
              <p className="text-xs text-stone-500">{open ? 'Place your order to skip line' : 'Counter only / kitchen closed'}</p>
            </div>
          </div>
        </div>
      </div>
      {live.length > 0 && (<div className="mb-8 space-y-3"><h2 className="font-semibold text-stone-900">Current order</h2>{live.map((o: any) => (
        <Link key={o.id} to={`/app/orders/${o.id}`} className="card flex items-center justify-between hover:border-brand-500"><div><p className="font-semibold text-stone-900">Order #{o.order_no}</p><p className="text-sm text-stone-500">{o.items.map((i: any) => `${i.quantity}x ${i.name_snapshot}`).join(', ')}</p></div><Badge s={o.status} label={LABEL[o.status as OrderStatus]} /></Link>))}</div>)}
      <h2 className="mb-3 font-semibold text-stone-900">Categories</h2>
      <div className="mb-8 flex flex-wrap gap-2">{cats.length === 0 ? <p className="text-sm text-stone-500">No categories yet.</p> : cats.map((c: any) => <Link key={c.id} to={`/app/menu?category=${c.id}`} className="btn-secondary">{c.name}</Link>)}</div>
      <h2 className="mb-3 font-semibold text-stone-900">Featured dishes</h2>
      {featured.length === 0 ? <Empty title="No featured dishes right now" action={<Link to="/app/menu" className="btn-primary">Browse the menu</Link>} /> : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{featured.map((f: any) => (
          <Link key={f.id} to={`/app/menu/${f.id}`} className="card p-3 hover:border-brand-500 hover:shadow-md transition">
            <FoodImage path={f.image_path} alt={f.name} className="h-32 w-full object-cover rounded-xl" />
            <div className="mt-2.5 flex items-center gap-2">
              <VegMark veg={f.is_veg} />
              <p className="font-semibold text-stone-900 truncate">{f.name}</p>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <p className="font-bold text-brand-700">{formatINR(Number(f.price))}</p>
              <span className="text-xs text-stone-400">{f.prep_minutes}m</span>
            </div>
          </Link>))}</div>)}
      <div className="grid gap-6 md:grid-cols-2">
        <div><h2 className="mb-3 font-semibold text-stone-900">Popular dishes</h2>{popular.length === 0 ? <Empty title="Popular dishes appear once orders come in" /> : <ul className="card space-y-2 text-sm">{popular.map((p: any, i: number) => <li key={p.food_item_id} className="flex justify-between"><Link to={`/app/menu/${p.food_item_id}`} className="font-medium text-stone-900 hover:text-brand-700">{i + 1}. {p.name}</Link><span className="text-stone-500">{p.qty} ordered</span></li>)}</ul>}</div>
        <div><h2 className="mb-3 font-semibold text-stone-900">Recent orders</h2>{orders.length === 0 ? <Empty title="No orders yet" action={<Link to="/app/menu" className="btn-primary">Order now</Link>} /> : <div className="card space-y-2 text-sm">{orders.slice(0, 4).map((o: any) => <Link key={o.id} to={`/app/orders/${o.id}`} className="flex items-center justify-between hover:text-brand-700"><span>#{o.order_no} · {fmtDate(o.created_at)}</span><Badge s={o.status} label={LABEL[o.status as OrderStatus]} /></Link>)}<Link to="/app/orders" className="block pt-1 text-brand-700 underline">View all orders</Link></div>}</div>
      </div>
    </>
  )
}
