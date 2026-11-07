import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { friendly, listNotifications, markAllRead, markRead, updateProfile } from '../lib/api'
import { newPasswordSchema, profileSchema, zodErrors } from '../lib/validation'
import { Alert, Empty, Field, PageHeader, Spinner, useAsync, fmtDate } from '../components/ui'

export function Notifications() {
  const { session } = useAuth()
  const { data, loading, reload } = useAsync(listNotifications)
  if (loading) return <Spinner full />
  return (
    <>
      <PageHeader title="Notifications" action={<button className="btn-secondary" onClick={async () => { await markAllRead(session!.user.id); reload() }}>Mark all read</button>} />
      {!data?.length ? <Empty title="You're all caught up" /> : (
        <div className="space-y-2">{data.map((n: any) => (
          <Link key={n.id} to={n.link ?? '/app'} onClick={() => !n.read_at && markRead(n.id)} className={`card block py-3 hover:border-brand-500 ${n.read_at ? 'opacity-70' : ''}`}>
            <div className="flex justify-between gap-2"><p className="font-medium text-stone-900">{n.title}</p><span className="text-xs text-stone-400">{fmtDate(n.created_at)}</span></div><p className="text-sm text-stone-600">{n.body}</p></Link>))}</div>)}
    </>
  )
}

export function Profile() {
  const { profile, session, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [err, setErr] = useState<Record<string, string>>({})
  const [pwErr, setPwErr] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ k: 'success' | 'error'; t: string } | null>(null)
  useEffect(() => { setName(profile?.full_name ?? ''); setPhone(profile?.phone ?? '') }, [profile])
  const save = async (e: FormEvent) => {
    e.preventDefault()
    const p = profileSchema.safeParse({ fullName: name, phone })
    if (!p.success) return setErr(zodErrors(p.error))
    setErr({})
    try { await updateProfile(session!.user.id, p.data); await refreshProfile(); setMsg({ k: 'success', t: 'Profile updated.' }) } catch (ex) { setMsg({ k: 'error', t: friendly(ex) }) }
  }
  const savePw = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const p = newPasswordSchema.safeParse(Object.fromEntries(new FormData(form)))
    if (!p.success) return setPwErr(zodErrors(p.error))
    setPwErr({})
    const { error } = await supabase.auth.updateUser({ password: p.data.password })
    if (error) return setMsg({ k: 'error', t: 'Could not change the password. Sign in again and retry.' })
    form.reset(); setMsg({ k: 'success', t: 'Password changed.' })
  }
  return (
    <>
      <PageHeader title="Profile" sub={session?.user.email} />
      {msg && <div className="mb-4"><Alert kind={msg.k}>{msg.t}</Alert></div>}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <form onSubmit={save} className="card space-y-3" noValidate><h2 className="font-semibold text-stone-900">Your details</h2>
          <Field label="Full name" error={err.fullName}><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Phone (optional)" error={err.phone}><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field><button className="btn-primary">Save</button></form>
        <form onSubmit={savePw} className="card space-y-3" noValidate><h2 className="font-semibold text-stone-900">Change password</h2>
          <Field label="New password" error={pwErr.password}><input name="password" type="password" autoComplete="new-password" className="input" /></Field><button className="btn-primary">Update password</button></form>
        <div className="card space-y-3"><h2 className="font-semibold text-stone-900">Session</h2>
          <button className="btn-secondary" onClick={async () => { await supabase.auth.signOut(); nav('/') }}>Log out</button>
          <button className="btn-danger" onClick={async () => { await supabase.auth.signOut({ scope: 'global' }); nav('/') }}>Log out of all devices</button></div>
      </div>
    </>
  )
}
