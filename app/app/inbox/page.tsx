'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import Link from 'next/link'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { CheckCircle2, CircleDashed, ArrowRight, Send, Loader2, Camera, Heart, User, BookOpen } from 'lucide-react'

const PAGE_SIZE = 30

type QuestionItem = {
    type: 'question'
    id: string
    date_key: string
    text: string
    category: string | null
    status: 'completed' | 'your_turn' | 'waiting' | 'unanswered'
    hasLog: boolean
}

type JournalItem = {
    type: 'journal'
    id: string
    date_key: string
    userName: string
    avatarUrl: string | null
    text: string | null
    imageCount: number
    isMe: boolean
}

type NudgeItem = {
    type: 'nudge'
    id: string
    date_key: string
    emoji: string
    message: string | null
    senderName: string
    isMe: boolean
    created_at: string
}

type FeedItem = QuestionItem | JournalItem | NudgeItem

function formatDateLabel(dateKey: string): string {
    const d = parseISO(dateKey)
    if (isToday(d)) return 'Today'
    if (isYesterday(d)) return 'Yesterday'
    return format(d, 'EEEE, MMM d')
}

export default function InboxPage() {
    const [feed, setFeed] = useState<FeedItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [page, setPage] = useState(0)
    const loadMoreRef = useRef<HTMLDivElement>(null)

    const supabase = createClient()
    const { user } = useAuth()

    const loadInbox = useCallback(async (pageNum: number, append = false) => {
        if (!user) return
        try {
            if (pageNum === 0) setIsLoading(true)
            else setIsLoadingMore(true)

            const { data: member } = await supabase
                .from('room_members')
                .select('room_id')
                .eq('user_id', user.id)
                .single()

            if (!member) return

            // Load profiles for name display
            const { data: members } = await supabase
                .from('room_members')
                .select('user_id, profiles(name, avatar_url)')
                .eq('room_id', member.room_id)

            const profileMap: Record<string, { name: string; avatar_url: string | null }> = {}
            if (members) {
                for (const m of members as any[]) {
                    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                    profileMap[m.user_id] = { name: p?.name || 'Partner', avatar_url: p?.avatar_url || null }
                }
            }

            // 1. Load questions (paginated — this drives pagination)
            const { data: dqData } = await supabase
                .from('daily_questions')
                .select(`
                    id, date_key, question_id,
                    questions(text, category),
                    answers(user_id)
                `)
                .eq('room_id', member.room_id)
                .order('date_key', { ascending: false })
                .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

            if (!dqData) return

            if (dqData.length < PAGE_SIZE) setHasMore(false)

            const dateKeys = dqData.map((d: any) => d.date_key)

            // 2. Load journal entries for these dates
            const { data: logData } = await supabase
                .from('daily_logs')
                .select('id, date_key, user_id, text, images')
                .eq('room_id', member.room_id)
                .in('date_key', dateKeys)

            // 3. Load nudges for these dates
            const { data: nudgeData } = await supabase
                .from('nudges')
                .select('id, sender_id, emoji, message, created_at')
                .eq('room_id', member.room_id)
                .gte('created_at', `${dateKeys[dateKeys.length - 1]}T00:00:00`)
                .lte('created_at', `${dateKeys[0]}T23:59:59`)
                .order('created_at', { ascending: false })

            const logDateSet = new Set((logData || []).map((l: any) => l.date_key))

            // Build question items
            const questionItems: QuestionItem[] = dqData.map((item: any) => {
                const myAnswer = item.answers?.find((a: any) => a.user_id === user.id)
                const theirAnswer = item.answers?.find((a: any) => a.user_id !== user.id)

                let status: QuestionItem['status']
                if (myAnswer && theirAnswer) status = 'completed'
                else if (theirAnswer && !myAnswer) status = 'your_turn'
                else if (myAnswer && !theirAnswer) status = 'waiting'
                else status = 'unanswered'

                return {
                    type: 'question' as const,
                    id: item.id,
                    date_key: item.date_key,
                    text: item.questions?.text || 'Unknown question',
                    category: item.questions?.category || null,
                    status,
                    hasLog: logDateSet.has(item.date_key),
                }
            })

            // Build journal items
            const journalItems: JournalItem[] = (logData || [])
                .filter((l: any) => l.text || (l.images && l.images.length > 0))
                .map((l: any) => ({
                    type: 'journal' as const,
                    id: `log_${l.id}`,
                    date_key: l.date_key,
                    userName: profileMap[l.user_id]?.name || 'Someone',
                    avatarUrl: profileMap[l.user_id]?.avatar_url || null,
                    text: l.text,
                    imageCount: l.images?.length || 0,
                    isMe: l.user_id === user.id,
                }))

            // Build nudge items (extract date_key from created_at)
            const nudgeItems: NudgeItem[] = (nudgeData || []).map((n: any) => ({
                type: 'nudge' as const,
                id: `nudge_${n.id}`,
                date_key: n.created_at.slice(0, 10),
                emoji: n.emoji,
                message: n.message,
                senderName: profileMap[n.sender_id]?.name || 'Someone',
                isMe: n.sender_id === user.id,
                created_at: n.created_at,
            }))

            // Combine & sort: group by date_key, question first, then journal, then nudges
            const allItems: FeedItem[] = [...questionItems, ...journalItems, ...nudgeItems]
            allItems.sort((a, b) => {
                // Sort by date descending
                if (a.date_key !== b.date_key) return b.date_key.localeCompare(a.date_key)
                // Within same date: question > journal > nudge
                const priority = { question: 0, journal: 1, nudge: 2 }
                return priority[a.type] - priority[b.type]
            })

            if (append) {
                setFeed(prev => [...prev, ...allItems])
            } else {
                setFeed(allItems)
            }
        } catch (err) {
            console.error('Error loading inbox', err)
        } finally {
            setIsLoading(false)
            setIsLoadingMore(false)
        }
    }, [user, supabase])

    useEffect(() => {
        loadInbox(0)
    }, [loadInbox])

    // Infinite scroll observer
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore) return
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
                const nextPage = page + 1
                setPage(nextPage)
                loadInbox(nextPage, true)
            }
        }, { threshold: 0.1 })

        observer.observe(loadMoreRef.current)
        return () => observer.disconnect()
    }, [hasMore, isLoadingMore, page, loadInbox])

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    // Separate "your turn" questions from the rest
    const yourTurnItems = feed.filter(i => i.type === 'question' && i.status === 'your_turn') as QuestionItem[]
    const timelineItems = feed.filter(i => !(i.type === 'question' && i.status === 'your_turn'))

    // Group timeline items by date for section headers
    const dateGroups: { dateKey: string; items: FeedItem[] }[] = []
    for (const item of timelineItems) {
        const last = dateGroups[dateGroups.length - 1]
        if (last && last.dateKey === item.date_key) {
            last.items.push(item)
        } else {
            dateGroups.push({ dateKey: item.date_key, items: [item] })
        }
    }

    return (
        <div className="p-4 space-y-6 pt-8 md:pt-12 pb-24">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
                <p className="text-sm text-zinc-400">Your shared timeline.</p>
            </div>

            {/* YOUR TURN — unanswered questions where partner already answered */}
            {yourTurnItems.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-rose-500">
                        Your Turn ({yourTurnItems.length})
                    </h2>
                    {yourTurnItems.map((item) => (
                        <Link key={item.id} href={`/app/inbox/${item.date_key}`} className="block group">
                            <div className="flex items-start space-x-4 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 hover:border-rose-500/50 transition-colors">
                                <div className="pt-1">
                                    <div className="relative">
                                        <Send className="h-5 w-5 text-rose-500" />
                                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-rose-500 rounded-full animate-pulse" />
                                    </div>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-snug group-hover:text-rose-400 transition-colors line-clamp-2">
                                        {item.text}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-zinc-500">{format(parseISO(item.date_key), 'MMM d, yyyy')}</p>
                                        {item.category && (
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                                                {item.category}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-rose-500/50 mt-1.5 group-hover:text-rose-400 transition-colors" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* TIMELINE — grouped by date */}
            {feed.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm border border-zinc-800 border-dashed rounded-xl">
                    No history yet. Start answering daily questions!
                </div>
            ) : (
                <div className="space-y-6">
                    {dateGroups.map(({ dateKey, items }) => (
                        <div key={dateKey} className="space-y-2">
                            {/* Date header */}
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 sticky top-0 bg-zinc-950/90 backdrop-blur-sm py-1 z-10">
                                {formatDateLabel(dateKey)}
                            </h3>

                            <div className="space-y-2">
                                {items.map((item) => {
                                    if (item.type === 'question') {
                                        const q = item as QuestionItem
                                        return (
                                            <Link key={q.id} href={`/app/inbox/${q.date_key}`} className="block group">
                                                <div className="flex items-start space-x-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 transition-colors">
                                                    <div className="pt-1">
                                                        {q.status === 'completed' ? (
                                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                        ) : q.status === 'waiting' ? (
                                                            <CircleDashed className="h-5 w-5 text-amber-500" />
                                                        ) : (
                                                            <CircleDashed className="h-5 w-5 text-zinc-700" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <p className="text-sm font-medium leading-snug group-hover:text-rose-400 transition-colors line-clamp-2">
                                                            {q.text}
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            {q.category && (
                                                                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                                                                    {q.category}
                                                                </span>
                                                            )}
                                                            {q.status === 'waiting' && (
                                                                <span className="text-[10px] text-amber-500">Waiting for partner</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        )
                                    }

                                    if (item.type === 'journal') {
                                        const j = item as JournalItem
                                        return (
                                            <Link key={j.id} href={`/app/inbox/${j.date_key}`} className="block group">
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60 hover:border-rose-500/30 transition-colors">
                                                    <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                                                        {j.avatarUrl ? (
                                                            <img src={j.avatarUrl} alt="" className="h-full w-full object-cover" />
                                                        ) : (
                                                            <User className="h-4 w-4 text-zinc-500" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm truncate">
                                                            <span className={`font-medium ${j.isMe ? 'text-rose-400' : 'text-zinc-300'}`}>
                                                                {j.isMe ? 'You' : j.userName}
                                                            </span>
                                                            <span className="text-zinc-500"> wrote in journal</span>
                                                        </p>
                                                        {j.text && (
                                                            <p className="text-xs text-zinc-500 truncate">{j.text}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {j.imageCount > 0 && (
                                                            <span className="flex items-center gap-0.5 text-[10px] text-rose-400">
                                                                <Camera className="w-3 h-3" /> {j.imageCount}
                                                            </span>
                                                        )}
                                                        <BookOpen className="w-3.5 h-3.5 text-zinc-600" />
                                                    </div>
                                                </div>
                                            </Link>
                                        )
                                    }

                                    if (item.type === 'nudge') {
                                        const n = item as NudgeItem
                                        return (
                                            <div
                                                key={n.id}
                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                                    n.isMe ? 'bg-rose-500/5 border-rose-500/10' : 'bg-zinc-900/40 border-zinc-800/40'
                                                }`}
                                            >
                                                <span className="text-xl">{n.emoji}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm truncate">
                                                        <span className={`font-medium ${n.isMe ? 'text-rose-400' : 'text-zinc-300'}`}>
                                                            {n.isMe ? 'You' : n.senderName}
                                                        </span>
                                                        <span className="text-zinc-500"> sent love</span>
                                                    </p>
                                                    {n.message && (
                                                        <p className="text-xs text-zinc-500 truncate">{n.message}</p>
                                                    )}
                                                </div>
                                                <Heart className="w-3.5 h-3.5 text-rose-500/40 shrink-0" />
                                            </div>
                                        )
                                    }

                                    return null
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Infinite scroll trigger */}
                    {hasMore && (
                        <div ref={loadMoreRef} className="flex justify-center py-4">
                            {isLoadingMore && <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
