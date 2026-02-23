'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    MessageSquare, Inbox, Activity, Settings, Heart,
    CalendarDays, MoreHorizontal, X, ChevronRight, Star
} from "lucide-react"
import { clsx } from "clsx"

/* ── Tab definitions ── */
const primaryTabs = [
    { name: "Today", href: "/app/questions", icon: MessageSquare },
    { name: "Inbox", href: "/app/inbox", icon: Inbox },
    { name: "Planner", href: "/app/planner", icon: CalendarDays },
    { name: "Love", href: "/app/nudge", icon: Heart },
]

const moreTabs = [
    { name: "Memories", href: "/app/memories", icon: Star },
    { name: "Progress", href: "/app/progress", icon: Activity },
    { name: "Settings", href: "/app/settings", icon: Settings },
]

const allTabs = [...primaryTabs, ...moreTabs]

/* ═══════════════════════════════════════════
   BOTTOM NAV (mobile) — 4 tabs + More sheet
   ═══════════════════════════════════════════ */
export function BottomNav() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const sheetRef = useRef<HTMLDivElement>(null)

    // Is a "more" route currently active?
    const moreActive = moreTabs.some(t => pathname.startsWith(t.href))

    // Close sheet on navigation
    useEffect(() => { setOpen(false) }, [pathname])

    // Close on outside click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
            setOpen(false)
        }
    }, [])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open])

    return (
        <>
            {/* Bottom bar */}
            <nav className="fixed bottom-0 z-50 w-full border-t border-zinc-800 bg-zinc-950/80 pb-safe backdrop-blur-md md:hidden">
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
                                    isActive ? "text-rose-500" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-[10px] font-medium leading-none">{item.name}</span>
                            </Link>
                        )
                    })}

                    {/* More button */}
                    <button
                        onClick={() => setOpen(prev => !prev)}
                        className={clsx(
                            "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                            open || moreActive ? "text-rose-500" : "text-zinc-500 hover:text-zinc-300"
                        )}
                        aria-expanded={open}
                        aria-label="More navigation"
                    >
                        <MoreHorizontal className="h-5 w-5" strokeWidth={open || moreActive ? 2.5 : 2} />
                        <span className="text-[10px] font-medium leading-none">More</span>
                    </button>
                </div>
            </nav>

            {/* Bottom sheet overlay */}
            {open && (
                <div
                    className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-150"
                    onClick={handleBackdropClick}
                >
                    <div
                        ref={sheetRef}
                        className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 rounded-t-2xl pb-safe animate-in slide-in-from-bottom-4 duration-200"
                    >
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full bg-zinc-700" />
                        </div>

                        {/* Close button */}
                        <div className="flex justify-end px-4 pb-1">
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                                aria-label="Close menu"
                            >
                                <X className="w-4 h-4 text-zinc-500" />
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
                                                ? "bg-zinc-800 text-rose-500"
                                                : "text-zinc-300 hover:bg-zinc-800/60"
                                        )}
                                    >
                                        <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                                        <span className="font-medium text-sm flex-1">{item.name}</span>
                                        <ChevronRight className="h-4 w-4 text-zinc-600" />
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

    return (
        <nav className="hidden md:flex flex-col w-64 border-r border-zinc-800 bg-zinc-950 min-h-screen pt-8 px-4">
            <div className="flex items-center space-x-2 px-4 mb-12">
                <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-rose-500" />
                </div>
                <span className="font-semibold tracking-tight text-lg">Two of Us</span>
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
                                    ? "bg-zinc-900 text-rose-500"
                                    : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-100"
                            )}
                        >
                            <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                            <span className="font-medium text-sm">{item.name}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
