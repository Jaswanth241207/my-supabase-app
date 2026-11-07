import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useCart } from '../auth/CartContext'
import { friendly, getSettings, placeOrder } from '../lib/api'
import { computeBill, formatINR } from '../lib/pricing'
import { checkoutSchema } from '../lib/validation'
import { Alert, Empty, FoodImage, PageHeader, Spinner, VegMark, useAsync } from '../components/ui'

function useBill() {
  const { lines } = useCart()
  const { data: settings } = useAsync(getSettings)
  const taxPercent = Number(settings?.tax_percent ?? 0)
  const bill = computeBill(lines.map((l) => ({ price: Number(l.food.price), quantity: l.quantity })), taxPercent)
  const unavailable = lines.filter((l) => !l.food.is_available || (typeof l.food.available_pieces === 'number' && l.food.available_pieces < l.quantity))
  return { lines, bill, taxPercent, unavailable, settings }
}
function BillBox({ bill, taxPercent }: { bill: ReturnType<typeof computeBill>; taxPercent: number }) {
  return (<div className="card space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{formatINR(bill.subtotal)}</span></div>
    <div className="flex justify-between"><span>Tax ({taxPercent}%)</span><span>{formatINR(bill.tax)}</span></div>
    {bill.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>-{formatINR(bill.discount)}</span></div>}
    <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold"><span>Total</span><span>{formatINR(bill.total)}</span></div></div>)
}

export function CartPage() {
  const { setQty, loading, error } = useCart()
  const { lines, bill, taxPercent, unavailable } = useBill()
  if (loading) return <Spinner full />
  return (
    <>
      <PageHeader title="Your cart" sub={lines.length > 0 ? `${lines.reduce((s, l) => s + l.quantity, 0)} item(s) in your tray` : undefined} />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {lines.length === 0 ? (
        <Empty title="Your cart is empty" hint="Explore delicious items from our fresh menu." action={<Link to="/app/menu" className="btn-primary">Browse the menu</Link>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-3 lg:col-span-2 xl:col-span-3">
            {lines.map((l) => (
              <div key={l.food.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:border-brand-200">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <FoodImage path={l.food.image_path} alt={l.food.name} className="h-18 w-18 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold text-stone-900">
                      <VegMark veg={l.food.is_veg} />
                      <span className="truncate">{l.food.name}</span>
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-brand-700">
                      {formatINR(Number(l.food.price))} <span className="font-normal text-stone-500">each</span>
                    </p>
                    {!l.food.is_available && (
                      <p className="mt-1 text-xs font-semibold text-red-600">No longer available. Remove it to continue.</p>
                    )}
                    {l.food.is_available && typeof l.food.available_pieces === 'number' && l.food.available_pieces < l.quantity && (
                      <p className="mt-1 text-xs font-semibold text-red-600">Only {l.food.available_pieces} pieces available. Please reduce quantity.</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50/50 p-1">
                    <button className="btn-secondary h-8 w-8 px-0" aria-label={`Decrease ${l.food.name}`} onClick={() => setQty(l.food.id, l.quantity - 1)}>
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center font-bold text-stone-900">{l.quantity}</span>
                    <button
                      className="btn-secondary h-8 w-8 px-0"
                      aria-label={`Increase ${l.food.name}`}
                      disabled={l.quantity >= Math.min(20, l.food.available_pieces ?? 20) || !l.food.is_available}
                      onClick={() => setQty(l.food.id, l.quantity + 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="w-20 text-right font-bold text-stone-900">{formatINR(Number(l.food.price) * l.quantity)}</span>
                  <button className="btn-danger h-8 w-8 px-0" aria-label={`Remove ${l.food.name}`} onClick={() => setQty(l.food.id, 0)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4 lg:col-span-1 xl:col-span-1">
            <BillBox bill={bill} taxPercent={taxPercent} />
            {unavailable.length > 0 && <Alert>Remove unavailable items before checkout.</Alert>}
            <Link
              to="/app/checkout"
              className={`btn-primary w-full py-3 text-center ${unavailable.length ? 'pointer-events-none opacity-50' : ''}`}
              aria-disabled={unavailable.length > 0}
            >
              Proceed to checkout
            </Link>
          </div>
        </div>
      )}
    </>
  )
}

export function CheckoutPage() {
  const nav = useNavigate()
  const { reload, loading } = useCart()
  const { lines, bill, taxPercent, unavailable, settings } = useBill()
  const key = useRef(crypto.randomUUID()) // one idempotency key per checkout screen: repeated clicks cannot create duplicate orders
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  if (loading) return <Spinner full />
  const cashOn = settings?.cash_enabled === true
  const open = settings?.canteen_open === true
  const submit = async () => {
    const p = checkoutSchema.safeParse({ notes })
    if (!p.success) return setMsg('Notes are too long (300 characters max).')
    setBusy(true); setMsg('')
    try { const id = await placeOrder('cash', p.data.notes ?? '', key.current); await reload(); nav(`/app/orders/${id}?placed=1`, { replace: true }) } catch (e) { setMsg(friendly(e)); setBusy(false) }
  }
  if (lines.length === 0) return <Empty title="Your cart is empty" action={<Link to="/app/menu" className="btn-primary">Browse the menu</Link>} />
  return (
    <>
      <PageHeader title="Checkout" sub="Review your order. Prices are confirmed by the server when you place it." />
      <div className="grid gap-6 lg:grid-cols-3 xl:grid-cols-4">
        <div className="space-y-4 lg:col-span-2 xl:col-span-3">
          <div className="card">
            <h2 className="font-semibold text-stone-900">Items in order</h2>
            <ul className="mt-3 divide-y divide-stone-100 text-sm">
              {lines.map((l) => (
                <li key={l.food.id} className="flex justify-between py-2.5">
                  <span className="font-medium text-stone-800">{l.quantity}x {l.food.name}</span>
                  <span className="font-semibold text-stone-900">{formatINR(Number(l.food.price) * l.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card space-y-3">
            <h2 className="font-semibold text-stone-900">Payment method</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3 text-sm cursor-pointer">
                <input type="radio" checked readOnly className="accent-orange-600" />
                <span className="font-medium text-stone-900">Pay at the counter (cash)</span>
                {!cashOn && <span className="text-xs font-semibold text-red-600"> - currently disabled</span>}
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-stone-200 p-3 text-sm text-stone-400 cursor-not-allowed">
                <input type="radio" disabled />
                <span>Online payment (UPI / Card - coming soon)</span>
              </label>
            </div>
          </div>
          <div className="card">
            <label className="label" htmlFor="notes">Special instructions for the kitchen (optional)</label>
            <textarea id="notes" placeholder="e.g. Less spicy, extra sauce..." className="input" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="space-y-4 lg:col-span-1 xl:col-span-1">
          <BillBox bill={bill} taxPercent={taxPercent} />
          {!open && <Alert>The canteen is closed for orders right now.</Alert>}
          {unavailable.length > 0 && <Alert>Remove unavailable items from your cart first.</Alert>}
          {msg && <Alert>{msg}</Alert>}
          <button className="btn-primary w-full py-3" disabled={busy || !cashOn || !open || unavailable.length > 0} onClick={submit}>
            {busy ? 'Placing order...' : `Place order - ${formatINR(bill.total)}`}
          </button>
          <p className="text-xs text-stone-500 leading-relaxed">
            Your order stays pending until the canteen confirms it. You will receive an instant queue number upon confirmation.
          </p>
        </div>
      </div>
    </>
  )
}
