import React, { lazy, Suspense } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import { RequireAdmin, RequireAuth } from './auth/AuthContext'
import { AppLayout, PublicLayout } from './components/Layout'
import { Alert, Spinner } from './components/ui'
import { isConfigured } from './lib/supabase'
import { Landing } from './pages/Public'
import { Login, Register, Forgot, ResetPassword } from './pages/AuthPages'

const named = <T extends Record<string, any>>(f: () => Promise<T>, k: keyof T) => lazy(() => f().then((m) => ({ default: m[k] as React.ComponentType })))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MenuPage = named(() => import('./pages/Menu'), 'MenuPage')
const FoodDetail = named(() => import('./pages/Menu'), 'FoodDetail')
const CartPage = named(() => import('./pages/Cart'), 'CartPage')
const CheckoutPage = named(() => import('./pages/Cart'), 'CheckoutPage')
const OrderList = named(() => import('./pages/Orders'), 'OrderList')
const OrderDetail = named(() => import('./pages/Orders'), 'OrderDetail')
const Notifications = named(() => import('./pages/Account'), 'Notifications')
const Profile = named(() => import('./pages/Account'), 'Profile')
const Admin = lazy(() => import('./pages/admin/Admin'))

export default function App() {
  return (
    <>
      {!isConfigured && <div className="w-full px-4 sm:px-6 lg:px-8 py-3"><Alert>Missing configuration: copy <code>.env.example</code> to <code>.env</code> and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart.</Alert></div>}
      <Suspense fallback={<Spinner full />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset" element={<ResetPassword />} />
          </Route>
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/menu" element={<MenuPage />} />
            <Route path="/app/menu/:id" element={<FoodDetail />} />
            <Route path="/app/cart" element={<CartPage />} />
            <Route path="/app/checkout" element={<CheckoutPage />} />
            <Route path="/app/orders" element={<OrderList />} />
            <Route path="/app/orders/:id" element={<OrderDetail />} />
            <Route path="/app/notifications" element={<Notifications />} />
            <Route path="/app/profile" element={<Profile />} />
          </Route>
          <Route element={<RequireAuth><RequireAdmin><AppLayout admin /></RequireAdmin></RequireAuth>}>
            <Route path="/admin/*" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
