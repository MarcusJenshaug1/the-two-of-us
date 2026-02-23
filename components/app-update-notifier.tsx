'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { UpdateBanner } from '@/components/update-banner'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes
const DISMISS_COOLDOWN = 30 * 60 * 1000 // 30 minutes
const LOCAL_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'unknown'
const LS_DISMISSED_KEY = 'update-dismissed'

type DismissedState = {
    version: string
    at: number
}

export function AppUpdateNotifier() {
    const [showBanner, setShowBanner] = useState(false)
    const waitingSW = useRef<ServiceWorker | null>(null)
    const remoteVersion = useRef<string | null>(null)

    // ─── Check if dismissed for this version within cooldown ───
    const isDismissed = useCallback((version: string): boolean => {
        try {
            const raw = localStorage.getItem(LS_DISMISSED_KEY)
            if (!raw) return false
            const state: DismissedState = JSON.parse(raw)
            if (state.version !== version) return false
            return Date.now() - state.at < DISMISS_COOLDOWN
        } catch {
            return false
        }
    }, [])

    // ─── Show banner (if not dismissed) ───
    const triggerUpdate = useCallback(
        (version: string) => {
            remoteVersion.current = version
            if (!isDismissed(version)) {
                setShowBanner(true)
            }
        },
        [isDismissed],
    )

    // ─── 1. Service Worker update detection ───
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

        let cancelled = false

        async function checkSW() {
            try {
                const registration = await navigator.serviceWorker.getRegistration()
                if (!registration || cancelled) return

                // Check if there's already a waiting SW
                if (registration.waiting) {
                    waitingSW.current = registration.waiting
                    triggerUpdate(remoteVersion.current || 'sw-update')
                }

                // Listen for new SW found
                registration.addEventListener('updatefound', () => {
                    const installing = registration.installing
                    if (!installing) return

                    installing.addEventListener('statechange', () => {
                        if (
                            installing.state === 'installed' &&
                            navigator.serviceWorker.controller
                        ) {
                            // New SW is waiting to activate
                            waitingSW.current = installing
                            triggerUpdate(remoteVersion.current || 'sw-update')
                        }
                    })
                })
            } catch (err) {
                console.warn('SW check failed:', err)
            }
        }

        checkSW()

        return () => {
            cancelled = true
        }
    }, [triggerUpdate])

    // ─── 2. Version polling ───
    useEffect(() => {
        if (typeof window === 'undefined') return

        let timer: ReturnType<typeof setInterval>
        let cancelled = false

        async function poll() {
            // Don't poll when tab is hidden
            if (document.hidden) return

            try {
                const res = await fetch(`/api/version?t=${Date.now()}`, {
                    cache: 'no-store',
                })
                if (!res.ok || cancelled) return
                const data = await res.json()
                const remote = data.version as string

                remoteVersion.current = remote

                if (remote && remote !== LOCAL_VERSION && remote !== 'unknown') {
                    triggerUpdate(remote)
                }
            } catch {
                // Network error — ignore silently (offline etc)
            }
        }

        // Initial check after a short delay (let app settle)
        const initialTimer = setTimeout(poll, 10_000)

        // Then poll every interval
        timer = setInterval(poll, POLL_INTERVAL)

        // Pause/resume on visibility change
        const handleVisibility = () => {
            if (!document.hidden) poll()
        }
        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            cancelled = true
            clearTimeout(initialTimer)
            clearInterval(timer)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [triggerUpdate])

    // ─── Handle "Oppdater" ───
    const handleUpdate = useCallback(() => {
        setShowBanner(false)

        if (waitingSW.current) {
            // Tell waiting SW to activate
            waitingSW.current.postMessage({ type: 'SKIP_WAITING' })

            // Reload when new controller takes over
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload()
            })

            // Safety fallback: if controllerchange doesn't fire within 3s, reload anyway
            setTimeout(() => window.location.reload(), 3000)
        } else {
            window.location.reload()
        }
    }, [])

    // ─── Handle "Senere" ───
    const handleDismiss = useCallback(() => {
        setShowBanner(false)
        try {
            const state: DismissedState = {
                version: remoteVersion.current || 'unknown',
                at: Date.now(),
            }
            localStorage.setItem(LS_DISMISSED_KEY, JSON.stringify(state))
        } catch {
            // localStorage unavailable
        }
    }, [])

    if (!showBanner) return null

    return <UpdateBanner onUpdate={handleUpdate} onDismiss={handleDismiss} />
}
