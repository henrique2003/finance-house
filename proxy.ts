import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

const publicPaths = ['/auth', '/invite']

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)
  const pathname = request.nextUrl.pathname
  if (publicPaths.some((path) => pathname.startsWith(path))) return response

  if (!request.cookies.has('casa-clara-session')) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
