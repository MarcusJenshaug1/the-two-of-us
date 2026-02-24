'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export type NotificationStatus = 'loading' | 'unsupported' | 'denied' | 'prompt' | 'subscribed' | 'unsubscribed'

export function useNotifications() {
    const [status, setStatus] = useState<NotificationStatus>('loading')
    const [isSubscribing, setIsSubscribing] = useState(false)
    const supabase = createClient()
    const { user } = useAuth()

    // Check current state
    useEffect(() => {
        if (!user) return

        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            setStatus('unsupported')
            return
        }

        if (Notification.permission === 'denied') {
            setStatus('denied')
            return
        }

        // Check if we have an active subscription
        navigator.serviceWorker.ready.then(async (registration) => {
            const subscription = await registration.pushManager.getSubscription()
            if (subscription) {
                setStatus('subscribed')
            } else if (Notification.permission === 'granted') {
                setStatus('unsubscribed')
            } else {
                setStatus('prompt')
            }
        }).catch(() => {
            setStatus('unsupported')
        })
    }, [user])

    // Service worker is registered by next-pwa automatically
    // We just need to wait for it to be ready

    const subscribe = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
        if (!user) return { ok: false, reason: 'no-user' }
        if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid-key' }
        setIsSubscribing(true)

        try {
            // Request permission
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                setStatus('denied')
                return { ok: false, reason: 'permission-denied' }
            }

            // Get service worker registration
            const registration = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Service worker not ready (timeout)')), 8000)
                ),
            ])

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            })

            const subscriptionJson = subscription.toJSON()

            // Save to database
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: subscriptionJson.endpoint!,
                    p256dh: subscriptionJson.keys!.p256dh!,
                    auth: subscriptionJson.keys!.auth!,
                }, { onConflict: 'user_id, endpoint' })

            if (error) throw error

            setStatus('subscribed')
            return { ok: true }
        } catch (err) {
            console.error('Failed to subscribe:', err)
            const msg = err instanceof Error ? err.message : 'Unknown error'
            return { ok: false, reason: msg }
        } finally {
            setIsSubscribing(false)
        }
    }, [user, supabase])

    const unsubscribe = useCallback(async () => {
        if (!user) return

        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                // Remove from database
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('endpoint', subscription.endpoint)

                // Unsubscribe from push
                await subscription.unsubscribe()
            }

            setStatus('unsubscribed')
        } catch (err) {
            console.error('Failed to unsubscribe:', err)
        }
    }, [user, supabase])

    return { status, subscribe, unsubscribe, isSubscribing }
}
