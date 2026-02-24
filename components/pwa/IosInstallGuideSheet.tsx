'use client'

import { useEffect, useRef } from 'react'
import { X, Share2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n'

interface IosInstallGuideSheetProps {
    isOpen: boolean
    onClose: () => void
}

export function IosInstallGuideSheet({ isOpen, onClose }: IosInstallGuideSheetProps) {
    const t = useTranslations('settings')
    const dialogRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    // Handle ESC key
    useEffect(() => {
        if (!isOpen) return

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        // Set focus to close button
        setTimeout(() => closeButtonRef.current?.focus(), 100)

        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
            role="presentation"
        >
            <div
                ref={dialogRef}
                className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-200 shadow-2xl"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ios-guide-title"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center">
                            <Share2 className="w-5 h-5 text-rose-300" />
                        </div>
                        <div>
                            <h2 id="ios-guide-title" className="text-lg font-semibold">
                                {t('iosInstallTitle')}
                            </h2>
                            <p className="text-xs text-zinc-400">{t('iosInstallSubtitle')}</p>
                        </div>
                    </div>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                        aria-label={t('iosCloseGuide')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Description */}
                <p className="text-sm text-zinc-300">
                    {t('iosInstallDescription')}
                </p>

                {/* Steps */}
                <div className="space-y-3">
                    <div className="flex gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/40">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold">
                            1
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">{t('iosStep1Title')}</p>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <Share2 className="w-4 h-4 text-blue-400" />
                                {t('iosStep1Desc')}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/40">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold">
                            2
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">{t('iosStep2Title')}</p>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <Plus className="w-4 h-4 text-zinc-300" />
                                {t('iosStep2Desc')}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/40">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold">
                            3
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">{t('iosStep3Title')}</p>
                            <p className="text-xs text-zinc-400">{t('iosStep3Desc')}</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <Button
                    onClick={onClose}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                >
                    {t('iosGotIt')}
                </Button>
            </div>
        </div>
    )
}
