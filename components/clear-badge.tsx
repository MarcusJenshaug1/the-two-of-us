'use client'

import { useEffect } from 'react'

export function ClearBadge() {
    useEffect(() => {
        // Clear app badge when user opens the app
        if ('clearAppBadge' in navigator) {
            (navigator as any).clearAppBadge?.()
        }
    }, [])

    return null
}
