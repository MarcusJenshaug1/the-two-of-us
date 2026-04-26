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

    useEffect(() => {
        if (!isOpen) return

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        setTimeout(() => closeButtonRef.current?.focus(), 100)

        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-[60] bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
            role="presentation"
        >
            <div
                ref={dialogRef}
                className="w-full sm:max-w-md bg-card text-card-foreground border border-border rounded-2xl p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-200 shadow-2xl"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ios-guide-title"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-2xl bg-accent border border-rose-200 flex items-center justify-center">
                            <Share2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 id="ios-guide-title" className="text-lg font-semibold">
                                {t('iosInstallTitle')}
                            </h2>
                            <p className="text-xs text-muted-foreground">{t('iosInstallSubtitle')}</p>
                        </div>
                    </div>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                        aria-label={t('iosCloseGuide')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Description */}
                <p className="text-sm text-foreground">
                    {t('iosInstallDescription')}
                </p>

                {/* Steps */}
                <div className="space-y-3">
                    <div className="flex gap-3 p-3 rounded-xl bg-secondary border border-border">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">
                            1
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">{t('iosStep1Title')}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Share2 className="w-4 h-4 text-primary" />
                                {t('iosStep1Desc')}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 p-3 rounded-xl bg-secondary border border-border">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">
                            2
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">{t('iosStep2Title')}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Plus className="w-4 h-4 text-foreground" />
                                {t('iosStep2Desc')}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 p-3 rounded-xl bg-secondary border border-border">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">
                            3
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium">{t('iosStep3Title')}</p>
                            <p className="text-xs text-muted-foreground">{t('iosStep3Desc')}</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <Button
                    onClick={onClose}
                    className="w-full"
                >
                    {t('iosGotIt')}
                </Button>
            </div>
        </div>
    )
}
