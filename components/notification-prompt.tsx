'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useTranslations } from '@/lib/i18n'

const LS_KEY = 'notif-prompt-shown'
const DELAY_MS = 3000

export function NotificationPrompt() {
    const [visible, setVisible] = useState(false)
    const [animateOut, setAnimateOut] = useState(false)
    const { status, subscribe, isSubscribing } = useNotifications()
    const { user } = useAuth()
    const t = useTranslations('notifPrompt')

    useEffect(() => {
        if (!user) return
        if (status !== 'prompt') return
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
            dismiss()
        }
    }

    if (!visible) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity duration-300 ${
                    animateOut ? 'opacity-0' : 'opacity-100'
                }`}
                onClick={dismiss}
            />

            {/* Card */}
            <div
                className={`relative w-full max-w-sm rounded-2xl bg-card text-card-foreground border border-border p-6 shadow-2xl transition-all duration-300 ${
                    animateOut
                        ? 'opacity-0 translate-y-4 scale-95'
                        : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-bottom-4'
                }`}
            >
                {/* Close */}
                <button
                    onClick={dismiss}
                    className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center">
                        <Bell className="h-7 w-7 text-primary" />
                    </div>
                </div>

                {/* Text */}
                <h3 className="text-lg font-semibold text-center mb-1">
                    {t('title')}
                </h3>
                <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
                    {t('body')}
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleEnable}
                        disabled={isSubscribing}
                        className="w-full py-2.5 rounded-xl bg-primary hover:bg-rose-700 text-primary-foreground text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {isSubscribing ? t('enabling') : t('enable')}
                    </button>
                    <button
                        onClick={dismiss}
                        className="w-full py-2.5 rounded-xl text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                        {t('later')}
                    </button>
                </div>
            </div>
        </div>
    )
}
