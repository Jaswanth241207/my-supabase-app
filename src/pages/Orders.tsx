import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, Printer } from 'lucide-react'
import { cancelOrder, friendly, getOrder, listOrders, reorder, subscribeOrder } from '../lib/api'
import { useCart } from '../auth/CartContext'
import { formatINR } from '../lib/pricing'
import { customerCanCancel, FLOW, LABEL, type OrderStatus } from '../lib/orderStatus'
import { Alert, Badge, ConfirmButton, Empty, PageHeader, Spinner, useAsync, fmtDate } from '../components/ui'

function useReorder() {
  const nav = useNavigate()
  const { reload } = useCart()
  const [msg, setMsg] = useState('')
  const go = async (id: string) => { try { const skipped = await reorder(id); await reload(); nav('/app/cart', { state: { skipped } }) } catch (e) { setMsg(friendly(e)) } }
  return { go, msg }
}

export function OrderList() {
  const { data, loading, error, reload } = useAsync(listOrders)
  const { go, msg } = useReorder()
  useEffect(() => subscribeOrder(null, reload), [reload])
  if (loading) return <Spinner full />
  if (error) return <Alert>Could not load your orders.</Alert>
  return (
    <>
      <PageHeader title="My orders" />
      {msg && <Alert>{msg}</Alert>}
      {!data?.length ? <Empty title="No orders yet" action={<Link to="/app/menu" className="btn-primary">Order now</Link>} /> : (
        <div className="space-y-3">{data.map((o: any) => (
          <div key={o.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:border-brand-200">
            <Link to={`/app/orders/${o.id}`} className="min-w-0 flex-1">
              <p className="font-semibold text-stone-900">Order #{o.order_no} <span className="text-sm font-normal text-stone-500">· {fmtDate(o.created_at)}</span></p>
              <p className="mt-0.5 truncate text-sm text-stone-600">{o.items.map((i: any) => `${i.quantity}x ${i.name_snapshot}`).join(', ')}</p>
            </Link>
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
              <span className="font-bold text-stone-900">{formatINR(Number(o.total))}</span>
              <Badge s={o.status} label={LABEL[o.status as OrderStatus]} />
              <button className="btn-secondary" onClick={() => go(o.id)}>Reorder</button>
            </div>
          </div>
        ))}</div>)}
    </>
  )
}

export function OrderDetail() {
  const { id = '' } = useParams()
  const [sp] = useSearchParams()
  const { data, loading, error, reload } = useAsync(() => getOrder(id), [id])
  const { go, msg: reorderMsg } = useReorder()
  const [msg, setMsg] = useState('')
  useEffect(() => subscribeOrder(id, reload), [id, reload])
  if (loading) return <Spinner full />
  if (error || !data) return <Alert>Order not found.</Alert>
  const { order: o, queue } = data
  const status = o.status as OrderStatus
  const idx = FLOW.indexOf(status)
  const pay = Array.isArray(o.payment) ? o.payment[0] : o.payment
  return (
    <>
      <PageHeader title={`Order #${o.order_no}`} sub={fmtDate(o.created_at)} action={<Badge s={status} label={LABEL[status]} />} />
      {sp.get('placed') && <div className="mb-4"><Alert kind="success">Order placed! The canteen will confirm it shortly. You can leave this page open to follow it live.</Alert></div>}
      {(msg || reorderMsg) && <div className="mb-4"><Alert>{msg || reorderMsg}</Alert></div>}
      {status === 'cancelled' ? <div className="mb-6"><Alert>This order was cancelled{o.cancel_reason ? `: ${o.cancel_reason}` : '.'}</Alert></div> : (
        <ol className="mb-6 flex flex-wrap gap-2" aria-label="Order progress">{FLOW.map((s, i) => (
          <li key={s} className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${i <= idx ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-500'}`}>{i < idx && <Check className="h-3 w-3" />}{LABEL[s]}</li>))}</ol>)}
      {queue && queue.queue_position != null && (
        <div className="card mb-6 flex flex-wrap items-center gap-6 border-brand-200 bg-brand-50">
          <div><p className="text-xs uppercase text-stone-500">{queue.queue_position === 0 ? 'Status' : 'Queue position'}</p><p className="text-3xl font-extrabold text-brand-700">{queue.queue_position === 0 ? 'Ready!' : `#${queue.queue_position}`}</p></div>
          {queue.queue_position > 0 && <div><p className="text-xs uppercase text-stone-500">Estimated wait</p><p className="text-xl font-bold text-stone-900">about {queue.est_minutes} min</p></div>}
        </div>)}
      <div className="grid gap-6 lg:grid-cols-3 xl:grid-cols-4">
        <div className="card lg:col-span-2 xl:col-span-3" id="bill">
          <h2 className="font-semibold text-stone-900">Bill summary</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-stone-500 border-b border-stone-100">
              <tr>
                <th className="py-2">Item</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Price</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {o.items.map((i: any) => (
                <tr key={i.id}>
                  <td className="py-2.5 font-medium text-stone-800">{i.name_snapshot}</td>
                  <td className="py-2.5">{i.quantity}</td>
                  <td className="py-2.5">{formatINR(Number(i.unit_price))}</td>
                  <td className="py-2.5 text-right font-semibold text-stone-900">{formatINR(Number(i.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-1.5 border-t border-stone-200 pt-3 text-sm">
            <div className="flex justify-between text-stone-600"><span>Subtotal</span><span>{formatINR(Number(o.subtotal))}</span></div>
            <div className="flex justify-between text-stone-600"><span>Tax</span><span>{formatINR(Number(o.tax_amount))}</span></div>
            {Number(o.discount_amount) > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>-{formatINR(Number(o.discount_amount))}</span></div>}
            <div className="flex justify-between text-base font-bold text-stone-900 pt-1 border-t border-stone-100"><span>Total</span><span>{formatINR(Number(o.total))}</span></div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-1 xl:col-span-1">
          <div className="card space-y-2 text-sm">
            <h2 className="font-semibold text-stone-900">Order Details</h2>
            <p className="flex justify-between items-center text-stone-700">
              <span>Payment:</span>
              <span className="font-medium flex items-center gap-1.5">{o.payment_method === 'cash' ? 'Cash at counter' : 'Online'} {pay && <Badge s={pay.status} />}</span>
            </p>
            {o.notes && <p className="text-stone-600 text-xs italic bg-stone-50 p-2 rounded-lg">Note: {o.notes}</p>}
            {o.status === 'pending' && o.expires_at && <p className="text-xs font-semibold text-amber-700 bg-amber-50 p-2 rounded-lg">Awaiting confirmation. Expires {fmtDate(o.expires_at)}.</p>}
            {o.completed_at && <p className="text-xs text-stone-500">Completed at {fmtDate(o.completed_at)}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn-secondary w-full" onClick={() => window.print()}><Printer className="h-4 w-4" />Print bill</button>
            <button className="btn-secondary w-full" onClick={() => go(o.id)}>Reorder items</button>
            {customerCanCancel(status) && (
              <ConfirmButton className="btn-danger w-full" message="Cancel this order?" onConfirm={async () => { try { await cancelOrder(o.id); await reload() } catch (e) { setMsg(friendly(e)) } }}>
                Cancel order
              </ConfirmButton>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
