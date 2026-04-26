'use client'

import { useEffect, useRef } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'

interface UpdateBannerProps {
    onUpdate: () => void
    onDismiss: () => void
}

export function UpdateBanner({ onUpdate, onDismiss }: UpdateBannerProps) {
    const t = useTranslations('updateBanner')
    const updateRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        updateRef.current?.focus()
    }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onDismiss()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onDismiss])

    return (
        <div
            role="alert"
            aria-live="polite"
            className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[200] animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
            <div className="bg-card text-card-foreground border border-border rounded-2xl p-4 shadow-2xl">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                        <div className="w-9 h-9 rounded-xl bg-accent border border-rose-200 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-primary" />
                        </div>
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{t('newVersion')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t('tapToUpdate')}
                        </p>
                    </div>

                    {/* Close */}
                    <button
                        onClick={onDismiss}
                        className="flex-shrink-0 p-1 rounded-lg hover:bg-secondary transition-colors"
                        aria-label={t('closeAriaLabel')}
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 ml-12">
                    <button
                        ref={updateRef}
                        onClick={onUpdate}
                        className="flex-1 py-2 px-4 bg-primary hover:bg-rose-700 text-primary-foreground text-sm font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card"
                    >
                        {t('update')}
                    </button>
                    <button
                        onClick={onDismiss}
                        className="py-2 px-4 bg-secondary hover:bg-muted text-secondary-foreground text-sm font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card"
                    >
                        {t('dismiss')}
                    </button>
                </div>
            </div>
        </div>
    )
}
