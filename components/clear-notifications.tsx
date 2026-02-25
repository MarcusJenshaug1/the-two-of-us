'use client'

import { useEffect } from 'react'

/**
 * Dismisses push notifications from the notification center
 * when the user opens the relevant page.
 *
 * Tags are matched exactly OR as a prefix:
 *   tag="event"  closes  "event", "event-abc", "event-123" …
 *
 * Also clears the app badge count.
 */
export function ClearNotifications({ tags }: { tags: string[] }) {
    useEffect(() => {
        // Clear app badge
        if ('clearAppBadge' in navigator) {
            (navigator as any).clearAppBadge?.()
        }

        // Tell service worker to close matching notifications
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CLEAR_NOTIFICATIONS',
                tags,
            })
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return null
}
