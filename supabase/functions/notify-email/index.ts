// Sends an email for each new row in public.notifications (Database Webhook -> this function).
// Email failure never affects the saved record; failures are logged to public.email_log.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEBHOOK_SECRET')
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('unauthorized', { status: 401 })

  const payload = await req.json().catch(() => null)
  if (!payload || payload.type !== 'INSERT' || payload.table !== 'notifications') return new Response('ignored', { status: 200 })
  const n = payload.record as { id: string; user_id: string; title: string; body: string; link: string | null; type: string }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const log = (status: string, error?: string) => admin.from('email_log').insert({ notification_id: n.id, status, error: error?.slice(0, 500) ?? null })

  try {
    const { data, error } = await admin.auth.admin.getUserById(n.user_id)
    const to = data?.user?.email
    if (error || !to) { await log('skipped', 'no recipient'); return new Response('no recipient', { status: 200 }) }

    const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
    const link = n.link && n.link.startsWith('/') ? `${appUrl}${n.link}` : appUrl
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM'),
        to: [to],
        subject: n.title,
        html: `<div style="font-family:sans-serif;max-width:480px"><h2 style="color:#C2410C">${esc(n.title)}</h2><p>${esc(n.body)}</p><p><a href="${esc(link)}" style="background:#C2410C;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Open BITEQ</a></p><p style="color:#64748b;font-size:12px">Skip the Queue, Grab Your Bite.</p></div>`,
      }),
    })
    if (!res.ok) { await log('failed', `${res.status} ${await res.text()}`); return new Response('email failed', { status: 200 }) }
    await log('sent')
    return new Response('ok', { status: 200 })
  } catch (e) {
    await log('failed', String(e))
    return new Response('error', { status: 200 })
  }
})
