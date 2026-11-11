import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

function safeNextPath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const next = safeNextPath(request.nextUrl.searchParams.get('next'))
  if (!code) return NextResponse.redirect(new URL('/auth/error', request.url))

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/auth/error', request.url))

  const cookieStore = await cookies()
  cookieStore.set('casa-clara-session', 'active', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return NextResponse.redirect(new URL(next, request.url))
}
