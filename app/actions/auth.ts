'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const sessionLifetime = 60 * 60 * 24 * 7
const sessionCookie = 'casa-clara-session'

function safeNextPath(value: FormDataEntryValue | null) {
  const path = typeof value === 'string' ? value : '/'
  return path.startsWith('/') && !path.startsWith('//') ? path : '/'
}

async function requestOrigin() {
  const requestHeaders = await headers()
  const origin = requestHeaders.get('origin')
  if (origin) return origin
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  return host ? `${protocol}://${host}` : 'http://localhost:3000'
}

function authErrorKey(error: { code?: string; status?: number; message?: string }, mode: 'login' | 'signup') {
  const detail = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (error.status === 429 || detail.includes('rate limit') || detail.includes('too many')) return 'rate-limit'
  if (detail.includes('email_not_confirmed') || detail.includes('email not confirmed')) return 'unconfirmed'
  if (detail.includes('weak_password') || detail.includes('password should')) return 'weak-password'
  if (detail.includes('invalid_email') || detail.includes('email_address_invalid')) return 'invalid-email'
  if (detail.includes('invalid_credentials') || detail.includes('invalid login credentials')) return 'credentials'
  return mode === 'login' ? 'unexpected' : 'signup'
}

async function setSessionDeadline() {
  const cookieStore = await cookies()
  cookieStore.set(sessionCookie, 'active', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionLifetime,
  })
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeNextPath(formData.get('next'))
  if (!email || !password) redirect('/auth/login?error=credentials')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect(`/auth/login?error=${authErrorKey(error, 'login')}`)

  await setSessionDeadline()
  redirect(next)
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeNextPath(formData.get('next'))
  if (!email || password.length < 8) redirect('/auth/sign-up?error=invalid')

  const callbackBase = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${await requestOrigin()}/auth/callback`
  const callbackUrl = new URL(callbackBase)
  callbackUrl.searchParams.set('next', next)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      data: { display_name: email.split('@')[0] },
    },
  })

  if (error) redirect(`/auth/sign-up?error=${authErrorKey(error, 'signup')}`)
  if (data.session) {
    await setSessionDeadline()
    redirect(next)
  }
  redirect('/auth/sign-up?success=confirm')
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const cookieStore = await cookies()
  cookieStore.delete(sessionCookie)
  redirect('/auth/login')
}
