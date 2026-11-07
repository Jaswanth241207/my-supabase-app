import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Clock, Coffee, ListOrdered, ShoppingBag, Smartphone, Sparkles, Users } from 'lucide-react'

const steps = [
  { icon: ShoppingBag, t: 'Order ahead', d: 'Browse the live menu and add dishes to your cart from anywhere.' },
  { icon: ListOrdered, t: 'Join the queue', d: 'Once the canteen confirms, you get a fair first-in, first-out queue position.' },
  { icon: Smartphone, t: 'Track live', d: 'Watch your order move from preparing to ready, with notifications.' },
  { icon: Clock, t: 'Grab and go', d: 'Walk in when it is ready. No standing in line.' },
]

export function Landing() {
  return (
    <>
      <section className="w-full border-b border-stone-200/70 bg-gradient-to-b from-brand-50/70 via-brand-50/30 to-canvas px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              <Sparkles className="h-3.5 w-3.5" />
              Smart Canteen Ordering & Live Queue
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
              Skip the Queue, Grab Your Bite.
            </h1>
            <p className="mt-4 text-lg text-stone-600 sm:text-xl">
              Order from your canteen, pay at pickup, and follow your order live. Fast, fair and reliable.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register" className="btn-primary text-base px-5 py-3">
                Create your account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="btn-secondary text-base px-5 py-3">
                Log in
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm font-medium text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-600" />
                Zero waiting in line
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-600" />
                Fair FIFO queue
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand-600" />
                Live seating updates
              </span>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="card space-y-4 border-brand-200 bg-white/95 p-6 shadow-md">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                    <Coffee className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase text-stone-400">Live Canteen Preview</p>
                    <p className="font-bold text-stone-900">Campus Central Canteen</p>
                  </div>
                </div>
                <span className="badge bg-green-100 text-green-800">Open</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Seating</span>
                  </div>
                  <p className="mt-1 font-bold text-emerald-700">25 seats free</p>
                </div>
                <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <Clock className="h-3.5 w-3.5 text-brand-600" />
                    <span>Avg. Wait</span>
                  </div>
                  <p className="mt-1 font-bold text-brand-700">~6-8 mins</p>
                </div>
              </div>

              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-800">Queue Ticket #12</span>
                  <span className="badge bg-brand-600 text-white text-[10px]">Preparing</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-stone-900">1x Masala Dosa, 1x Cold Coffee</p>
                <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                  <span>Queue position: <strong>#2</strong></span>
                  <span>Ready soon</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full px-4 sm:px-6 lg:px-8 py-14 md:py-18">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">How BITEQ works</h2>
          <p className="mt-1 text-sm text-stone-500">Four simple steps to faster meals with zero physical queues.</p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.t} className="card p-6 flex flex-col justify-between hover:border-brand-300 hover:shadow-md transition">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <s.icon className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-bold text-stone-300">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-stone-900">{s.t}</h3>
                <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
