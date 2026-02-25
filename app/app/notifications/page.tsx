'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
    Bell, Heart, MessageCircle, BookOpen, Star, Trophy,
    Smile, Send, CheckCheck, Sparkles, Calendar, Clock
} from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslations, useLocale } from '@/lib/i18n'
import { ClearNotifications } from '@/components/clear-notifications'

type Notification = {
    id: string
    type: string
    title: string
    body: string | null
    url: string
    read: boolean
    created_at: string
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string }> = {
    'nudge':            { icon: Heart,          color: 'text-rose-400' },
    'mood':             { icon: Smile,          color: 'text-amber-400' },
    'message':          { icon: MessageCircle,  color: 'text-blue-400' },
    'journal':          { icon: BookOpen,        color: 'text-emerald-400' },
    'memory':           { icon: Star,           color: 'text-yellow-400' },
    'milestone':        { icon: Trophy,         color: 'text-purple-400' },
    'partner-answered': { icon: CheckCheck,     color: 'text-sky-400' },
    'reaction':         { icon: Sparkles,       color: 'text-orange-400' },
    'daily-question':   { icon: Send,           color: 'text-indigo-400' },
    'reminder':         { icon: Clock,          color: 'text-teal-400' },
    'anniversary':      { icon: Calendar,       color: 'text-pink-400' },
    'default':          { icon: Bell,           color: 'text-zinc-400' },
}

function getConfig(type: string) {
    return TYPE_CONFIG[type] ?? TYPE_CONFIG['default']
}

function timeAgo(dateStr: string, locale: string): string {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diff = Math.max(0, now - then)
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (locale === 'no') {
        if (mins < 1) return 'Akkurat nå'
        if (mins < 60) return `${mins} min siden`
        if (hours < 24) return `${hours} ${hours === 1 ? 'time' : 'timer'} siden`
        if (days < 7) return `${days} ${days === 1 ? 'dag' : 'dager'} siden`
        return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
    }

    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en', { day: 'numeric', month: 'short' })
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const t = useTranslations('notifCenter')
    const { locale } = useLocale()

    const fetchNotifications = useCallback(async () => {
        const supabase = createClient()
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)

        if (data) setNotifications(data)
        setLoading(false)
    }, [])

    // Fetch + mark all as read on mount
    useEffect(() => {
        const supabase = createClient()
        let channel: ReturnType<typeof supabase.channel> | null = null

        fetchNotifications().then(async () => {
            // Mark all unread as read after a short delay
            setTimeout(async () => {
                const { error } = await supabase
                    .from('notifications')
                    .update({ read: true })
                    .eq('read', false)

                if (!error) {
                    // Also update local state so UI reflects read status
                    setNotifications(prev =>
                        prev.map(n => n.read ? n : { ...n, read: true })
                    )
                }
            }, 800)
        })

        // Realtime: new notifications appear instantly
        channel = supabase
            .channel('notif-page')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
            }, (payload) => {
                setNotifications(prev => [payload.new as Notification, ...prev])
            })
            .subscribe()

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [fetchNotifications])

    const unreadCount = notifications.filter(n => !n.read).length

    // Mark a single notification as read when tapped
    const markAsRead = useCallback(async (id: string) => {
        const supabase = createClient()
        // Optimistic local update
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        )
        await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id)
    }, [])

    return (
        <div className="min-h-screen">
            {/* Clear OS push notifications */}
            <ClearNotifications tags={[
                'nudge', 'mood', 'message', 'journal', 'memory', 'milestone',
                'partner-answered', 'reaction', 'daily-question', 'reminder', 'anniversary'
            ]} />

            {/* Header */}
            <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
                <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Bell className="h-5 w-5 text-rose-500" />
                        <h1 className="text-lg font-semibold">{t('title')}</h1>
                        {unreadCount > 0 && (
                            <span className="min-w-[20px] h-5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center px-1.5">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="divide-y divide-zinc-800/50">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="h-6 w-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                        <Bell className="h-10 w-10 mb-3 opacity-50" />
                        <p className="text-sm">{t('empty')}</p>
                    </div>
                ) : (
                    notifications.map((notif) => {
                        const config = getConfig(notif.type)
                        const Icon = config.icon
                        return (
                            <Link
                                key={notif.id}
                                href={notif.url}
                                onClick={() => { if (!notif.read) markAsRead(notif.id) }}
                                className={clsx(
                                    "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-900/50 active:bg-zinc-900",
                                    !notif.read && "bg-zinc-900/30"
                                )}
                            >
                                {/* Icon */}
                                <div className={clsx(
                                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                                    !notif.read ? "bg-zinc-800" : "bg-zinc-900"
                                )}>
                                    <Icon className={clsx("h-4 w-4", config.color)} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p className={clsx(
                                        "text-sm leading-snug",
                                        !notif.read ? "text-zinc-100 font-medium" : "text-zinc-400"
                                    )}>
                                        {notif.title}
                                    </p>
                                    {notif.body && (
                                        <p className="text-xs text-zinc-500 mt-0.5 truncate">
                                            {notif.body}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        {timeAgo(notif.created_at, locale)}
                                    </p>
                                </div>

                                {/* Unread dot */}
                                {!notif.read && (
                                    <div className="mt-2 h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                                )}
                            </Link>
                        )
                    })
                )}
            </div>
        </div>
    )
}
