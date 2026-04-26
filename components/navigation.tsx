'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    MessageSquare, Inbox, Activity, Settings, Heart,
    CalendarDays, MoreHorizontal, X, ChevronRight, Star, Bell
} from "lucide-react"
import { clsx } from "clsx"
import { useTranslations } from "@/lib/i18n"
import { useInboxBadge } from "@/hooks/use-inbox-badge"

/* ── Tab definitions ── */
const primaryTabs = [
    { key: "today", href: "/app/questions", icon: MessageSquare, badge: false },
    { key: "inbox", href: "/app/inbox", icon: Inbox, badge: false },
    { key: "notifications", href: "/app/notifications", icon: Bell, badge: true },
    { key: "love", href: "/app/nudge", icon: Heart, badge: false },
]

const moreTabs = [
    { key: "planner", href: "/app/planner", icon: CalendarDays, badge: false },
    { key: "memories", href: "/app/memories", icon: Star, badge: false },
    { key: "progress", href: "/app/progress", icon: Activity, badge: false },
    { key: "settings", href: "/app/settings", icon: Settings, badge: false },
]

const allTabs = [...primaryTabs, ...moreTabs]

/* ═══════════════════════════════════════════
   BOTTOM NAV (mobile) — 4 tabs + More sheet
   ═══════════════════════════════════════════ */
export function BottomNav() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const sheetRef = useRef<HTMLDivElement>(null)
    const t = useTranslations('nav')
    const badgeCount = useInboxBadge()

    const moreActive = moreTabs.some(t => pathname.startsWith(t.href))

    useEffect(() => { setOpen(false) }, [pathname])

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
            setOpen(false)
        }
    }, [])

    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open])

    return (
        <>
            {/* Bottom bar */}
            <nav className="fixed bottom-0 z-50 w-full border-t border-border bg-background/85 pb-safe backdrop-blur-md md:hidden">
                <div className="flex justify-around items-center h-16">
                    {primaryTabs.map((item) => {
                        const isActive = pathname.startsWith(item.href)
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={clsx(
                                    "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <div className="relative">
                                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                                    {'badge' in item && item.badge && badgeCount > 0 && (
                                        <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                                            {badgeCount > 9 ? '9+' : badgeCount}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-medium leading-none">{t(item.key)}</span>
                            </Link>
                        )
                    })}

                    {/* More button */}
                    <button
                        onClick={() => setOpen(prev => !prev)}
                        className={clsx(
                            "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                            open || moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-expanded={open}
                        aria-label="More navigation"
                    >
                        <MoreHorizontal className="h-5 w-5" strokeWidth={open || moreActive ? 2.5 : 2} />
                        <span className="text-[10px] font-medium leading-none">{t('more')}</span>
                    </button>
                </div>
            </nav>

            {/* Bottom sheet overlay */}
            {open && (
                <div
                    className="fixed inset-0 z-[55] bg-zinc-950/40 backdrop-blur-sm md:hidden animate-in fade-in duration-150"
                    onClick={handleBackdropClick}
                >
                    <div
                        ref={sheetRef}
                        className="absolute bottom-0 left-0 right-0 bg-card text-card-foreground border-t border-border rounded-t-2xl pb-safe animate-in slide-in-from-bottom-4 duration-200 shadow-xl"
                    >
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-border" />
                        </div>

                        {/* Close button */}
                        <div className="flex justify-end px-4 pb-1">
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                                aria-label="Close menu"
                            >
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Menu items */}
                        <div className="px-4 pb-6 space-y-1">
                            {moreTabs.map((item) => {
                                const isActive = pathname.startsWith(item.href)
                                const Icon = item.icon
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={clsx(
                                            "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors",
                                            isActive
                                                ? "bg-accent text-accent-foreground"
                                                : "text-foreground hover:bg-secondary"
                                        )}
                                    >
                                        <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                                        <span className="font-medium text-sm flex-1">{t(item.key)}</span>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

/* ═══════════════════════════════════════════
   SIDE NAV (desktop) — all items, plenty of space
   ═══════════════════════════════════════════ */
export function SideNav() {
    const pathname = usePathname()
    const t = useTranslations('nav')
    const badgeCount = useInboxBadge()

    return (
        <nav className="hidden md:flex flex-col w-64 border-r border-border bg-background min-h-screen pt-8 px-4">
            <div className="flex items-center space-x-2 px-4 mb-12">
                <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold tracking-tight text-lg text-foreground">Two of Us</span>
            </div>

            <div className="space-y-1 flex-1">
                {allTabs.map((item) => {
                    const isActive = pathname.startsWith(item.href)
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={clsx(
                                "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
                                isActive
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                        >
                            <div className="relative">
                                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                                {'badge' in item && item.badge && badgeCount > 0 && (
                                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                                        {badgeCount > 9 ? '9+' : badgeCount}
                                    </span>
                                )}
                            </div>
                            <span className="font-medium text-sm">{t(item.key)}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
