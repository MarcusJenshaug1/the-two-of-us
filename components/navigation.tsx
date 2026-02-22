'use client'

import Link from "next/link"
import { MessageSquare, Inbox, Activity, Settings } from "lucide-react"
import { clsx } from "clsx"
import { usePathname } from "next/navigation"

const navItems = [
    { name: "Questions", href: "/app/questions", icon: MessageSquare },
    { name: "Inbox", href: "/app/inbox", icon: Inbox },
    { name: "Progress", href: "/app/progress", icon: Activity },
    { name: "Settings", href: "/app/settings", icon: Settings },
]

export function BottomNav() {
    const pathname = usePathname()

    return (
        <nav className="fixed bottom-0 z-50 w-full border-t border-zinc-800 bg-zinc-950/80 pb-safe backdrop-blur-md md:hidden">
            <div className="flex justify-around items-center h-16">
                {navItems.map((item) => {
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
                            <span className="text-[10px] font-medium">{item.name}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}

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
                {navItems.map((item) => {
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
