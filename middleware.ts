import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

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

    // Protected routes: /app and /onboarding
    const isAppRoute = request.nextUrl.pathname.startsWith('/app')
    const isOnboardingRoute = request.nextUrl.pathname.startsWith('/onboarding')

    if ((isAppRoute || isOnboardingRoute) && !user) {
        return NextResponse.redirect(new URL('/sign-in', request.url))
    }

    // Redirect logged in users away from sign-in page to questions
    if (request.nextUrl.pathname === '/sign-in' && user) {
        return NextResponse.redirect(new URL('/app/questions', request.url))
    }

    return response
}

export const config = {
    matcher: ['/app/:path*', '/onboarding/:path*', '/sign-in'],
}
