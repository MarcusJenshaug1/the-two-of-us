'use client'

import { useEffect } from 'react'

/**
 * Registers /sw.js as the service worker.
 * Placed in root layout so it runs once on app load.
 */
export function ServiceWorkerRegister() {
    useEffect(() => {
        if (
            typeof window === 'undefined' ||
            !('serviceWorker' in navigator) ||
            process.env.NODE_ENV === 'development'
        ) {
            return
        }

        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then((reg) => {
                console.log('[SW] registered, scope:', reg.scope)
            })
            .catch((err) => {
                console.error('[SW] registration failed:', err)
            })
    }, [])

    return null
}
