'use client'

import { useAuth } from '@/lib/supabase/auth-provider'

/**
 * Returns true while the page should show its loading spinner.
 *
 * The spinner stays visible while:
 *   1. AuthProvider is still bootstrapping the session, OR
 *   2. There is no authenticated user (AuthProvider will redirect shortly), OR
 *   3. The page's own data load is in progress.
 *
 * This prevents the "spinner forever" bug where a page mounted before auth
 * resolved would skip its data loader and never clear its initial loading state.
 */
export function usePageLoading(localLoading: boolean): boolean {
    const { user, isLoading } = useAuth()
    if (isLoading) return true
    if (!user) return true
    return localLoading
}
