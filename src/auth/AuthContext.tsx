import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, isConfigured } from '../lib/supabase'
import type { Row } from '../lib/api'
import { Spinner } from '../components/ui'

interface Auth { session: Session | null; profile: Row | null; loading: boolean; refreshProfile: () => Promise<void> }
const Ctx = createContext<Auth>({ session: null, profile: null, loading: true, refreshProfile: async () => {} })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Row | null>(null)
  const [loading, setLoading] = useState(true)
  const load = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data)
    if (data?.status === 'suspended') await supabase.auth.signOut()
  }
  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(async ({ data }) => { setSession(data.session); if (data.session) await load(data.session.user.id); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (s) setTimeout(() => load(s.user.id), 0); else setProfile(null) })
    return () => sub.subscription.unsubscribe()
  }, [])
  return <Ctx.Provider value={{ session, profile, loading, refreshProfile: async () => { if (session) await load(session.user.id) } }}>{children}</Ctx.Provider>
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Spinner full />
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <>{children}</>
}
/** UI gate only. Real enforcement is in Postgres (RLS + SECURITY DEFINER checks). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return <Spinner full />
  if (profile?.role !== 'admin') return <Navigate to="/app" replace />
  return <>{children}</>
}
