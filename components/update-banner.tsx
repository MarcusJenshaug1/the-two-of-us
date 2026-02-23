'use client'

import { useEffect, useRef } from 'react'
import { RefreshCw, X } from 'lucide-react'

interface UpdateBannerProps {
    onUpdate: () => void
    onDismiss: () => void
}

export function UpdateBanner({ onUpdate, onDismiss }: UpdateBannerProps) {
    const updateRef = useRef<HTMLButtonElement>(null)

    // Focus the "Oppdater" button on mount for a11y
    useEffect(() => {
        updateRef.current?.focus()
    }, [])

    // ESC key dismisses
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
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 shadow-2xl shadow-black/50">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-rose-400" />
                        </div>
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-100">Ny versjon tilgjengelig</p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Trykk Oppdater for å få nyeste versjon.
                        </p>
                    </div>

                    {/* Close */}
                    <button
                        onClick={onDismiss}
                        className="flex-shrink-0 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                        aria-label="Lukk oppdateringsmelding"
                    >
                        <X className="w-4 h-4 text-zinc-500" />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 ml-12">
                    <button
                        ref={updateRef}
                        onClick={onUpdate}
                        className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                    >
                        Oppdater
                    </button>
                    <button
                        onClick={onDismiss}
                        className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                    >
                        Senere
                    </button>
                </div>
            </div>
        </div>
    )
}
