import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, Menu, ShoppingCart, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { CartProvider, useCart } from '../auth/CartContext'
import { supabase } from '../lib/supabase'
import { countUnread, getSettings, subscribeNotifications, type Row } from '../lib/api'
import { Logo } from './ui'

const link = ({ isActive }: { isActive: boolean }) => `rounded-xl px-4 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-brand-600 text-white' : 'text-stone-700 hover:bg-brand-50'}`

export function PublicLayout() {
  const { session } = useAuth()
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <Link to="/" aria-label="BITEQ home"><Logo /></Link>
          <nav className="flex items-center gap-3" aria-label="Main">
            {session ? <Link to="/app" className="btn-primary">Open app</Link> : <><Link to="/login" className="btn-secondary">Log in</Link><Link to="/register" className="btn-primary">Sign up</Link></>}
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full"><Outlet /></main>
      <footer className="w-full border-t border-stone-200 bg-white py-6 px-4 sm:px-6 lg:px-8 text-center text-sm text-stone-500">
        BITEQ - Skip the Queue, Grab Your Bite.
      </footer>
    </div>
  )
}

function Header({ admin }: { admin: boolean }) {
  const { profile, session } = useAuth()
  const { count } = useCart()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [settings, setSettings] = useState<Row | null>(null)
  const uid = session?.user.id
  useEffect(() => {
    getSettings().then(setSettings).catch(() => {})
    if (!uid) return
    const refresh = () => countUnread(uid).then(setUnread).catch(() => {})
    refresh()
    return subscribeNotifications(uid, refresh)
  }, [uid])
  const items = admin
    ? [['/admin', 'Overview'], ['/admin/orders', 'Orders'], ['/admin/queue', 'Queue'], ['/admin/foods', 'Foods'], ['/admin/categories', 'Categories'], ['/admin/users', 'Users']]
    : [['/app', 'Home'], ['/app/menu', 'Menu'], ['/app/orders', 'My orders']]
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="w-full flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="flex items-center gap-8">
          <Link to={admin ? '/admin' : '/app'}><Logo /></Link>
          <nav className="hidden items-center gap-2 md:flex" aria-label="App">
            {items.map(([to, l]) => <NavLink key={to} to={to} end={to === '/app' || to === '/admin'} className={link}>{l}</NavLink>)}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {!admin && settings && (
            <span className={`hidden lg:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${settings.canteen_full === true || Number(settings.available_seats ?? 1) <= 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${settings.canteen_full === true || Number(settings.available_seats ?? 1) <= 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
              {settings.canteen_full === true || Number(settings.available_seats ?? 1) <= 0 ? 'Canteen Full' : `${settings.available_seats ?? 25} seats free`}
            </span>
          )}
          {profile?.role === 'admin' && <Link to={admin ? '/app' : '/admin'} className="btn-secondary hidden sm:inline-flex">{admin ? 'Customer view' : 'Admin'}</Link>}
          {!admin && <Link to="/app/cart" className="btn-secondary relative" aria-label={`Cart, ${count} items`}><ShoppingCart className="h-4 w-4" />{count > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{count}</span>}</Link>}
          <Link to="/app/notifications" className="btn-secondary relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Bell className="h-4 w-4" />{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{unread}</span>}</Link>
          <Link to="/app/profile" className="btn-secondary hidden sm:inline-flex">{profile?.full_name ?? 'Profile'}</Link>
          <button className="btn-secondary md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
        </div>
      </div>
      {open && <nav className="border-t border-stone-200 bg-white px-4 py-2 md:hidden" aria-label="Mobile"><div className="grid gap-1">
        {[...items, ['/app/profile', 'Profile']].map(([to, l]) => <NavLink key={to} to={to} end onClick={() => setOpen(false)} className={link}>{l}</NavLink>)}
        <button className="rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-brand-50" onClick={async () => { await supabase.auth.signOut(); nav('/') }}>Log out</button></div></nav>}
    </header>
  )
}

export function AppLayout({ admin = false }: { admin?: boolean }) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-canvas">
        <Header admin={admin} />
        <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </CartProvider>
  )
}
