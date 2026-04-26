import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // ── Locale cookie (set once based on domain) ──
    if (!request.cookies.get('locale')) {
        const host = request.headers.get('host') || ''
        const locale = host.endsWith('.no') ? 'no' : 'en'
        const isSecure = request.nextUrl.protocol === 'https:'
        response.cookies.set('locale', locale, {
            path: '/',
            maxAge: 365 * 24 * 60 * 60,
            sameSite: 'lax',
            secure: isSecure,
        })
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname
    const isAppRoute = pathname.startsWith('/app')
    const isOnboardingRoute = pathname.startsWith('/onboarding')
    const isSignIn = pathname === '/sign-in'
    const isRoot = pathname === '/'

    // 1. Not logged in -> can only access /sign-in and /invite (invite handles its own redirect)
    if (!user && (isAppRoute || isOnboardingRoute)) {
        return NextResponse.redirect(new URL('/sign-in', request.url))
    }

    // 2. Logged in -> check room membership for /app routes, /sign-in, and / redirect
    if (user && (isAppRoute || isSignIn || isRoot)) {
        const { data: membership } = await supabase
            .from('room_members')
            .select('room_id')
            .eq('user_id', user.id)
            .maybeSingle()

        // No room yet -> send to onboarding (not /app)
        if (!membership && isAppRoute) {
            return NextResponse.redirect(new URL('/onboarding/room', request.url))
        }

        // Signed in on /sign-in or / -> send to correct place (PWA start_url is /)
        if (isSignIn || isRoot) {
            if (!membership) {
                return NextResponse.redirect(new URL('/onboarding/profile', request.url))
            }
            return NextResponse.redirect(new URL('/app/questions', request.url))
        }
    }

    return response
}

export const config = {
    matcher: ['/', '/app/:path*', '/onboarding/:path*', '/sign-in', '/invite/:path*'],
}
