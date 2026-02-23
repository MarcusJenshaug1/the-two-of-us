'use client'

import { useEffect, useRef } from 'react'
import { X, Share2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface IosInstallGuideSheetProps {
    isOpen: boolean
    onClose: () => void
}

export function IosInstallGuideSheet({ isOpen, onClose }: IosInstallGuideSheetProps) {
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
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={onClose}
            role="presentation"
        >
            <div
                ref={dialogRef}
                className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-300"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ios-guide-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 id="ios-guide-title" className="text-lg font-semibold">
                        Install App
                    </h2>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                        aria-label="Close install guide"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <p className="text-sm text-zinc-300">
                        Add Two of Us to your home screen for quick access.
                    </p>
                </div>

                {/* Steps */}
                <div className="space-y-4">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 text-sm font-bold">
                            1
                        </div>
                        <div className="space-y-1 pt-0.5">
                            <p className="text-sm font-medium">Tap the Share button</p>
                            <p className="text-xs text-zinc-500">
                                Look for the share icon at the bottom of Safari
                            </p>
                            <div className="mt-2 flex justify-center p-3 bg-zinc-800/50 rounded-lg">
                                <Share2 className="w-8 h-8 text-blue-400" />
                            </div>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 text-sm font-bold">
                            2
                        </div>
                        <div className="space-y-1 pt-0.5">
                            <p className="text-sm font-medium">Select "Add to Home Screen"</p>
                            <p className="text-xs text-zinc-500">
                                Scroll down in the menu if needed
                            </p>
                            <div className="mt-2 flex items-center justify-center gap-2 p-3 bg-zinc-800/50 rounded-lg">
                                <Plus className="w-5 h-5 text-zinc-300" />
                                <span className="text-sm text-zinc-300">Add to Home Screen</span>
                            </div>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 text-sm font-bold">
                            3
                        </div>
                        <div className="space-y-1 pt-0.5">
                            <p className="text-sm font-medium">Tap "Add" to confirm</p>
                            <p className="text-xs text-zinc-500">
                                The app will be added to your home screen
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <Button
                    onClick={onClose}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                >
                    Got it
                </Button>
            </div>
        </div>
    )
}
