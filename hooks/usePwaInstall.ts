import { useState, useEffect } from 'react'

export type PwaInstallPlatform = 'ios' | 'supported' | 'unsupported'
export type InstallPromptResult = 'accepted' | 'dismissed' | 'unavailable'

interface PwaInstallState {
    isInstallable: boolean
    isInstalled: boolean
    platform: PwaInstallPlatform
    iosGuideOpen: boolean
}

/**
 * Hook to manage PWA installation across iOS (guide) and Android/Desktop (native prompt).
 *
 * Returns:
 * - isInstallable: true if we should show install button/banner
 * - isInstalled: true if app is already installed (standalone mode)
 * - platform: 'ios' | 'supported' | 'unsupported'
 * - iosGuideOpen: true if iOS guide sheet is open
 * - promptInstall(): trigger native install (Android/Desktop) or unavailable (iOS)
 * - openIosGuide(): open iOS installation guide
 * - closeIosGuide(): close iOS guide
 */
export function usePwaInstall() {
    const [state, setState] = useState<PwaInstallState>({
        isInstallable: false,
        isInstalled: false,
        platform: 'unsupported',
        iosGuideOpen: false,
    })

    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

    useEffect(() => {
        // Detect platform
        const ua = navigator.userAgent
        const isIos =
            /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

        // Detect if already installed
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as any).standalone === true

        if (isStandalone) {
            setState(prev => ({
                ...prev,
                isInstalled: true,
                isInstallable: false,
            }))
            return
        }

        if (isIos) {
            setState(prev => ({
                ...prev,
                platform: 'ios',
                isInstallable: true,
            }))
        } else {
            // Listen for beforeinstallprompt
            const handler = (e: Event) => {
                e.preventDefault()
                setDeferredPrompt(e)
                setState(prev => ({
                    ...prev,
                    platform: 'supported',
                    isInstallable: true,
                }))
            }

            window.addEventListener('beforeinstallprompt', handler)

            // Listen for appinstalled event
            const installedHandler = () => {
                setState(prev => ({
                    ...prev,
                    isInstalled: true,
                    isInstallable: false,
                }))
                setDeferredPrompt(null)
            }

            window.addEventListener('appinstalled', installedHandler)

            return () => {
                window.removeEventListener('beforeinstallprompt', handler)
                window.removeEventListener('appinstalled', installedHandler)
            }
        }
    }, [])

    const promptInstall = async (): Promise<InstallPromptResult> => {
        if (state.platform === 'ios') {
            return 'unavailable'
        }

        if (!deferredPrompt) {
            return 'unavailable'
        }

        try {
            await deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice

            setDeferredPrompt(null)
            setState(prev => ({ ...prev, isInstallable: false }))

            return outcome === 'accepted' ? 'accepted' : 'dismissed'
        } catch (err) {
            console.error('Error during install prompt:', err)
            return 'unavailable'
        }
    }

    const openIosGuide = () => {
        setState(prev => ({ ...prev, iosGuideOpen: true }))
    }

    const closeIosGuide = () => {
        setState(prev => ({ ...prev, iosGuideOpen: false }))
    }

    return {
        ...state,
        promptInstall,
        openIosGuide,
        closeIosGuide,
    }
}
