import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { emailSchema, loginSchema, newPasswordSchema, registerSchema, zodErrors } from '../lib/validation'
import { Alert, Field } from '../components/ui'

const wrap = (title: string, children: React.ReactNode) => (
  <div className="w-full flex justify-center px-4 sm:px-6 lg:px-8 py-12 md:py-20">
    <div className="w-full max-w-md card">
      <h1 className="mb-4 text-2xl font-bold text-stone-900">{title}</h1>
      {children}
    </div>
  </div>
)
const obj = (e: FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/app')

export function Login() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [err, setErr] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setMsg('')
    const p = loginSchema.safeParse(obj(e))
    if (!p.success) return setErr(zodErrors(p.error))
    setErr({}); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword(p.data)
    setBusy(false)
    if (error) return setMsg(/not confirmed/i.test(error.message) ? 'Please confirm your email first. Check your inbox.' : 'Invalid email or password.')
    nav(safeNext(sp.get('next')), { replace: true })
  }
  return wrap('Log in', (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {msg && <Alert>{msg}</Alert>}
      <Field label="Email" error={err.email}><input name="email" type="email" autoComplete="email" className="input" /></Field>
      <Field label="Password" error={err.password}><input name="password" type="password" autoComplete="current-password" className="input" /></Field>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in...' : 'Log in'}</button>
      <p className="text-center text-sm text-slate-600"><Link to="/forgot" className="text-brand-700 underline">Forgot password?</Link> · <Link to="/register" className="text-brand-700 underline">Create account</Link></p>
    </form>
  ))
}

export function Register() {
  const [err, setErr] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setMsg('')
    const p = registerSchema.safeParse(obj(e))
    if (!p.success) return setErr(zodErrors(p.error))
    setErr({}); setBusy(true)
    const { error } = await supabase.auth.signUp({ email: p.data.email, password: p.data.password, options: { data: { full_name: p.data.fullName }, emailRedirectTo: `${window.location.origin}/login` } })
    setBusy(false)
    if (error) return setMsg(/rate/i.test(error.message) ? 'Too many attempts. Please wait and try again.' : 'Could not create the account. Check your details and try again.')
    setDone(true)
  }
  if (done) return wrap('Check your email', <Alert kind="success">We sent a confirmation link. Confirm your email, then <Link to="/login" className="underline">log in</Link>.</Alert>)
  return wrap('Create your account', (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {msg && <Alert>{msg}</Alert>}
      <Field label="Full name" error={err.fullName} hint="Shown on your orders."><input name="fullName" autoComplete="name" className="input" /></Field>
      <Field label="Email" error={err.email}><input name="email" type="email" autoComplete="email" className="input" /></Field>
      <Field label="Password" error={err.password} hint="At least 10 characters, with a letter and a number."><input name="password" type="password" autoComplete="new-password" className="input" /></Field>
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating...' : 'Sign up'}</button>
      <p className="text-center text-sm text-slate-600">Already registered? <Link to="/login" className="text-brand-700 underline">Log in</Link></p>
    </form>
  ))
}

export function Forgot() {
  const [err, setErr] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const p = emailSchema.safeParse(obj(e))
    if (!p.success) return setErr(zodErrors(p.error))
    await supabase.auth.resetPasswordForEmail(p.data.email, { redirectTo: `${window.location.origin}/reset` })
    setSent(true) // same response whether or not the account exists
  }
  if (sent) return wrap('Check your email', <Alert kind="success">If an account exists for that address, a reset link is on its way.</Alert>)
  return wrap('Reset password', (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email" error={err.email}><input name="email" type="email" className="input" /></Field>
      <button className="btn-primary w-full">Send reset link</button>
    </form>
  ))
}

export function ResetPassword() {
  const nav = useNavigate()
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)))
    const { data } = supabase.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') setReady(true) })
    return () => data.subscription.unsubscribe()
  }, [])
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const p = newPasswordSchema.safeParse(obj(e))
    if (!p.success) return setErr(zodErrors(p.error))
    const { error } = await supabase.auth.updateUser({ password: p.data.password })
    if (error) return setMsg('Could not update the password. The link may have expired.')
    await supabase.auth.signOut({ scope: 'global' })
    nav('/login')
  }
  if (!ready) return wrap('Reset password', <Alert kind="info">Open the reset link from your email to continue.</Alert>)
  return wrap('Choose a new password', (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {msg && <Alert>{msg}</Alert>}
      <Field label="New password" error={err.password}><input name="password" type="password" autoComplete="new-password" className="input" /></Field>
      <button className="btn-primary w-full">Update password</button>
    </form>
  ))
}
