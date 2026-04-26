'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from './client'
import { Session, User } from '@supabase/supabase-js'

type AuthContextType = {
    user: User | null
    session: Session | null
    isLoading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PROTECTED_PREFIXES = ['/app', '/onboarding']

function isProtectedPath(pathname: string | null): boolean {
    if (!pathname) return false
    return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()
    const pathname = usePathname()
    const supabase = createClient()

    // Tracks the last known user id to detect *real* identity changes vs. token rotations
    const lastUserIdRef = useRef<string | null>(null)
    const initializedRef = useRef(false)

    useEffect(() => {
        let cancelled = false

        // 1. Initial bootstrap: verify session against the server (NOT just localStorage)
        const bootstrap = async () => {
            try {
                const { data: { user: verifiedUser } } = await supabase.auth.getUser()
                if (cancelled) return

                if (verifiedUser) {
                    const { data: { session: currentSession } } = await supabase.auth.getSession()
                    if (cancelled) return
                    setUser(verifiedUser)
                    setSession(currentSession)
                    lastUserIdRef.current = verifiedUser.id
                } else {
                    setUser(null)
                    setSession(null)
                    lastUserIdRef.current = null
                    // If we're on a protected page with no valid session, send to sign-in
                    if (isProtectedPath(pathname)) {
                        router.replace('/sign-in')
                    }
                }
            } catch {
                if (!cancelled) {
                    setUser(null)
                    setSession(null)
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false)
                    initializedRef.current = true
                }
            }
        }

        bootstrap()

        // 2. Subscribe to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, newSession) => {
                if (cancelled) return

                const newUser = newSession?.user ?? null
                const prevUserId = lastUserIdRef.current
                const newUserId = newUser?.id ?? null

                setSession(newSession)
                setUser(newUser)
                lastUserIdRef.current = newUserId
                setIsLoading(false)

                // Skip the synthetic INITIAL_SESSION event — bootstrap() handles it
                if (event === 'INITIAL_SESSION') return

                if (event === 'SIGNED_OUT') {
                    router.refresh()
                    if (isProtectedPath(pathname)) {
                        router.replace('/sign-in')
                    }
                    return
                }

                if (event === 'SIGNED_IN') {
                    // Only refresh if this is a different user than before
                    if (prevUserId !== newUserId) {
                        router.refresh()
                    }
                    return
                }

                if (event === 'TOKEN_REFRESHED') {
                    // Token rotated for the same user — refresh RSC so server reads fresh cookie
                    router.refresh()
                    return
                }

                if (event === 'USER_UPDATED') {
                    router.refresh()
                }
            }
        )

        return () => {
            cancelled = true
            subscription.unsubscribe()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // 3. Re-validate session when PWA returns to foreground (covers stale-session-on-resume)
    useEffect(() => {
        if (typeof document === 'undefined') return

        const onVisibility = async () => {
            if (document.hidden || !initializedRef.current) return
            try {
                const { data: { user: verifiedUser } } = await supabase.auth.getUser()
                const previousId = lastUserIdRef.current
                const verifiedId = verifiedUser?.id ?? null

                if (previousId && !verifiedId) {
                    // Session expired server-side while we were backgrounded
                    setUser(null)
                    setSession(null)
                    lastUserIdRef.current = null
                    router.refresh()
                    if (isProtectedPath(pathname)) {
                        router.replace('/sign-in')
                    }
                } else if (previousId !== verifiedId) {
                    // User changed (e.g., signed in on another tab)
                    router.refresh()
                }
            } catch {
                // Network issues — leave state alone
            }
        }

        document.addEventListener('visibilitychange', onVisibility)
        return () => document.removeEventListener('visibilitychange', onVisibility)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname])

    const signOut = async () => {
        try {
            await supabase.auth.signOut()
        } catch {
            // Ignore — we still clear local state below
        }
        setUser(null)
        setSession(null)
        lastUserIdRef.current = null
        router.refresh()
        router.replace('/sign-in')
    }

    return (
        <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
