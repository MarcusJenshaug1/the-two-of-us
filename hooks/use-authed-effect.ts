'use client'

import { useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '@/lib/supabase/auth-provider'

/**
 * Runs an effect only when the AuthProvider has finished bootstrapping AND a
 * verified user exists. Provides an AbortSignal so in-flight work can be
 * cancelled when auth changes or the component unmounts.
 *
 * If there is no user after auth resolves, the AuthProvider is responsible
 * for navigating to /sign-in — this hook simply skips the effect.
 *
 * Pass primitive values (e.g. `user.id`) in deps. The hook already keys on
 * `user?.id` and `isLoading` internally.
 */
export function useAuthedEffect(
    effect: (user: User, signal: AbortSignal) => void | Promise<void>,
    deps: React.DependencyList = []
) {
    const { user, isLoading } = useAuth()

    useEffect(() => {
        if (isLoading) return
        if (!user) return

        const controller = new AbortController()

        Promise.resolve(effect(user, controller.signal)).catch((err) => {
            if (err?.name === 'AbortError') return
            console.error('[useAuthedEffect]', err)
        })

        return () => controller.abort()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, user?.id, ...deps])
}
