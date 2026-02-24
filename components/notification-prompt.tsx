'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useTranslations } from '@/lib/i18n'

const LS_KEY = 'notif-prompt-shown'
const DELAY_MS = 3000 // 3 seconds after mount

/**
 * One-time notification opt-in prompt.
 * Shows once after a short delay when:
 *  - User is logged in
 *  - Notifications are supported
 *  - Permission hasn't been granted or denied yet
 *  - Prompt hasn't been shown before
 *
 * If dismissed, user can still enable from Settings.
 */
export function NotificationPrompt() {
    const [visible, setVisible] = useState(false)
    const [animateOut, setAnimateOut] = useState(false)
    const { status, subscribe, isSubscribing } = useNotifications()
    const { user } = useAuth()
    const t = useTranslations('notifPrompt')

    useEffect(() => {
        if (!user) return
        if (status !== 'prompt') return

        // Already shown once?
        try {
            if (localStorage.getItem(LS_KEY)) return
        } catch { return }

        const timer = setTimeout(() => setVisible(true), DELAY_MS)
        return () => clearTimeout(timer)
    }, [user, status])

    const dismiss = () => {
        setAnimateOut(true)
        setTimeout(() => setVisible(false), 300)
        try { localStorage.setItem(LS_KEY, '1') } catch {}
    }

    const handleEnable = async () => {
        try { localStorage.setItem(LS_KEY, '1') } catch {}
        const result = await subscribe()
        if (result.ok) {
            setAnimateOut(true)
            setTimeout(() => setVisible(false), 300)
        } else {
            // Still dismiss on failure — they can retry from settings
            dismiss()
        }
    }

    if (!visible) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
                    animateOut ? 'opacity-0' : 'opacity-100'
                }`}
                onClick={dismiss}
            />

            {/* Card */}
            <div
                className={`relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl transition-all duration-300 ${
                    animateOut
                        ? 'opacity-0 translate-y-4 scale-95'
                        : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-bottom-4'
                }`}
            >
                {/* Close */}
                <button
                    onClick={dismiss}
                    className="absolute top-3 right-3 p-1.5 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className="h-14 w-14 rounded-full bg-rose-500/10 flex items-center justify-center">
                        <Bell className="h-7 w-7 text-rose-400" />
                    </div>
                </div>

                {/* Text */}
                <h3 className="text-lg font-semibold text-center mb-1">
                    {t('title')}
                </h3>
                <p className="text-sm text-zinc-400 text-center mb-6 leading-relaxed">
                    {t('body')}
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleEnable}
                        disabled={isSubscribing}
                        className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isSubscribing ? t('enabling') : t('enable')}
                    </button>
                    <button
                        onClick={dismiss}
                        className="w-full py-2.5 rounded-xl text-zinc-400 hover:text-zinc-300 text-sm transition-colors"
                    >
                        {t('later')}
                    </button>
                </div>
            </div>
        </div>
    )
}
