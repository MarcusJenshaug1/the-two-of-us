'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import en from './messages/en.json'
import no from './messages/no.json'

export type Locale = 'en' | 'no'

const messages: Record<Locale, Record<string, any>> = { en, no }

type TranslateFunction = (key: string, params?: Record<string, string | number>) => string

interface LocaleContextValue {
    locale: Locale
    setLocale: (locale: Locale) => void
    t: TranslateFunction
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function getNestedValue(obj: any, path: string): string | undefined {
    return path.split('.').reduce((acc, part) => acc?.[part], obj) as string | undefined
}

function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

function detectDefaultLocale(): Locale {
    // 1. Check cookie
    if (typeof document !== 'undefined') {
        const match = document.cookie.match(/(?:^|;\s*)locale=(\w+)/)
        if (match && (match[1] === 'en' || match[1] === 'no')) return match[1] as Locale
    }
    // 2. Check domain
    if (typeof window !== 'undefined') {
        const host = window.location.hostname
        if (host.endsWith('.no')) return 'no'
    }
    // 3. Check browser language
    if (typeof navigator !== 'undefined') {
        const lang = navigator.language?.toLowerCase()
        if (lang?.startsWith('nb') || lang?.startsWith('nn') || lang?.startsWith('no')) return 'no'
    }
    return 'en'
}

function setLocaleCookie(locale: Locale) {
    document.cookie = `locale=${locale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`
}

export function LocaleProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setLocaleState(detectDefaultLocale())
        setMounted(true)
    }, [])

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale)
        setLocaleCookie(newLocale)
    }, [])

    const t: TranslateFunction = useCallback((key: string, params?: Record<string, string | number>) => {
        const value = getNestedValue(messages[locale], key)
        if (value === undefined) {
            // Fallback to English
            const fallback = getNestedValue(messages.en, key)
            if (fallback === undefined) return key
            return interpolate(fallback, params)
        }
        return interpolate(value, params)
    }, [locale])

    // Avoid hydration mismatch: render English on server, then switch on client
    const contextValue: LocaleContextValue = {
        locale: mounted ? locale : 'en',
        setLocale,
        t: mounted ? t : (key, params) => {
            const value = getNestedValue(messages.en, key)
            return value ? interpolate(value, params) : key
        },
    }

    return (
        <LocaleContext.Provider value={contextValue}>
            {children}
        </LocaleContext.Provider>
    )
}

export function useLocale(): LocaleContextValue {
    const ctx = useContext(LocaleContext)
    if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
    return ctx
}

export function useTranslations(namespace?: string): TranslateFunction {
    const { t } = useLocale()
    if (!namespace) return t
    return (key: string, params?: Record<string, string | number>) => t(`${namespace}.${key}`, params)
}
