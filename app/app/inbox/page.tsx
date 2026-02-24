'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import Link from 'next/link'
import { format, parseISO, isToday, isYesterday, type Locale } from 'date-fns'
import { CheckCircle2, CircleDashed, ArrowRight, Send, Loader2, Camera, User, BookOpen, MessageCircle, CalendarDays, MapPin, Clock, Trophy, Lightbulb, Star, Check } from 'lucide-react'
import { useTranslations, useLocale } from '@/lib/i18n'
import { getDateLocale } from '@/lib/i18n/date-locale'

const PAGE_SIZE = 30

type QuestionItem = {
    type: 'question'
    id: string
    date_key: string
    text: string
    category: string | null
    status: 'completed' | 'your_turn' | 'waiting' | 'unanswered'
    hasLog: boolean
    messageCount: number
    lastMessage: string | null
    lastMessageBy: string | null
    isLastMessageMine: boolean
}

type JournalItem = {
    type: 'journal'
    id: string
    date_key: string
    userName: string
    avatarUrl: string | null
    text: string | null
    imageCount: number
    entryCount: number
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

type EventItem = {
    type: 'event'
    id: string
    date_key: string
    title: string
    location: string | null
    start_at: string
    all_day: boolean
}

type TaskItem = {
    type: 'task'
    id: string
    date_key: string
    title: string
    is_done: boolean
    due_at: string | null
}

type MemoryItem = {
    type: 'memory'
    id: string
    memoryId: string
    date_key: string
    title: string
    imageCount: number
    location: string | null
}

type MilestoneItem = {
    type: 'milestone'
    id: string
    date_key: string
    title: string
    kind: string
}

type DatePlanItem = {
    type: 'dateplan'
    id: string
    date_key: string
    ideaTitle: string
    status: string
}

type FeedItem = QuestionItem | JournalItem | NudgeItem | EventItem | TaskItem | MemoryItem | MilestoneItem | DatePlanItem

function formatDateLabel(dateKey: string, dateLoc?: Locale): { type: 'today' | 'yesterday' | 'date'; formatted: string } {
    const d = parseISO(dateKey)
    if (isToday(d)) return { type: 'today', formatted: '' }
    if (isYesterday(d)) return { type: 'yesterday', formatted: '' }
    return { type: 'date', formatted: format(d, 'EEEE, MMM d', { locale: dateLoc }) }
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
    const t = useTranslations('inbox')
    const { locale } = useLocale()
    const dateLoc = getDateLocale(locale)

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
                .select('id, date_key, user_id, text, images, created_at')
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

            // 4. Load events for these dates
            const { data: eventData } = await supabase
                .from('shared_events')
                .select('id, title, location, start_at, all_day, date_key')
                .eq('room_id', member.room_id)
                .in('date_key', dateKeys)

            // 5. Load tasks with due dates in these dates
            const { data: taskData } = await supabase
                .from('shared_tasks')
                .select('id, title, is_done, due_at, due_date_key')
                .eq('room_id', member.room_id)
                .in('due_date_key', dateKeys)

            // 6. Load memories for these dates
            const { data: memoryData } = await supabase
                .from('memories')
                .select('id, title, images, location, date_key')
                .eq('room_id', member.room_id)
                .in('date_key', dateKeys)

            // 7. Load milestones for these dates
            const { data: milestoneData } = await supabase
                .from('milestones')
                .select('id, title, kind, happened_at')
                .eq('room_id', member.room_id)
                .in('happened_at', dateKeys)

            // 8. Load date plans for these dates
            const { data: datePlanData } = await supabase
                .from('date_completions')
                .select('id, status, planned_for, date_ideas(title)')
                .eq('room_id', member.room_id)
                .in('planned_for', dateKeys)
                .neq('status', 'skipped')

            const logDateSet = new Set((logData || []).map((l: any) => l.date_key))

            // 9. Load latest messages per question
            const dqIds = dqData.map((d: any) => d.id)
            const { data: msgData } = await supabase
                .from('messages')
                .select('id, daily_question_id, user_id, text, created_at')
                .in('daily_question_id', dqIds)
                .order('created_at', { ascending: false })

            // Group messages by daily_question_id
            const msgMap: Record<string, { count: number; lastText: string; lastUserId: string }> = {}
            for (const m of (msgData || []) as any[]) {
                if (!msgMap[m.daily_question_id]) {
                    msgMap[m.daily_question_id] = { count: 0, lastText: m.text, lastUserId: m.user_id }
                }
                msgMap[m.daily_question_id].count++
            }

            // Build question items
            const questionItems: QuestionItem[] = dqData.map((item: any) => {
                const myAnswer = item.answers?.find((a: any) => a.user_id === user.id)
                const theirAnswer = item.answers?.find((a: any) => a.user_id !== user.id)

                let status: QuestionItem['status']
                if (myAnswer && theirAnswer) status = 'completed'
                else if (theirAnswer && !myAnswer) status = 'your_turn'
                else if (myAnswer && !theirAnswer) status = 'waiting'
                else status = 'unanswered'

                const msgInfo = msgMap[item.id]
                return {
                    type: 'question' as const,
                    id: item.id,
                    date_key: item.date_key,
                    text: item.questions?.text || 'Unknown question',
                    category: item.questions?.category || null,
                    status,
                    hasLog: logDateSet.has(item.date_key),
                    messageCount: msgInfo?.count || 0,
                    lastMessage: msgInfo?.lastText || null,
                    lastMessageBy: msgInfo ? (profileMap[msgInfo.lastUserId]?.name || null) : null,
                    isLastMessageMine: msgInfo ? msgInfo.lastUserId === user.id : false,
                }
            })

            // Build journal items
            const journalGroupMap = new Map<string, {
                date_key: string
                user_id: string
                entryCount: number
                imageCount: number
                latestText: string | null
                latestCreatedAt: string | null
            }>()

            for (const l of (logData || []) as any[]) {
                if (!l.text && (!l.images || l.images.length === 0)) continue
                const key = `${l.date_key}_${l.user_id}`
                const existing = journalGroupMap.get(key)
                const createdAt = l.created_at || null
                if (!existing) {
                    journalGroupMap.set(key, {
                        date_key: l.date_key,
                        user_id: l.user_id,
                        entryCount: 1,
                        imageCount: l.images?.length || 0,
                        latestText: l.text || null,
                        latestCreatedAt: createdAt,
                    })
                } else {
                    existing.entryCount += 1
                    existing.imageCount += l.images?.length || 0
                    if (createdAt && (!existing.latestCreatedAt || createdAt > existing.latestCreatedAt)) {
                        existing.latestCreatedAt = createdAt
                        existing.latestText = l.text || existing.latestText
                    } else if (!existing.latestText && l.text) {
                        existing.latestText = l.text
                    }
                }
            }

            const journalItems: JournalItem[] = Array.from(journalGroupMap.values()).map((j) => ({
                type: 'journal' as const,
                id: `log_${j.date_key}_${j.user_id}`,
                date_key: j.date_key,
                userName: profileMap[j.user_id]?.name || 'Someone',
                avatarUrl: profileMap[j.user_id]?.avatar_url || null,
                text: j.latestText,
                imageCount: j.imageCount,
                entryCount: j.entryCount,
                isMe: j.user_id === user.id,
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

            // Build event items
            const eventItems: EventItem[] = (eventData || []).map((e: any) => ({
                type: 'event' as const,
                id: `event_${e.id}`,
                date_key: e.date_key,
                title: e.title,
                location: e.location,
                start_at: e.start_at,
                all_day: e.all_day,
            }))

            // Build task items
            const taskItems: TaskItem[] = (taskData || []).map((t: any) => ({
                type: 'task' as const,
                id: `task_${t.id}`,
                date_key: t.due_date_key,
                title: t.title,
                is_done: t.is_done,
                due_at: t.due_at,
            }))

            // Build memory items
            const memoryItems: MemoryItem[] = (memoryData || []).map((m: any) => ({
                type: 'memory' as const,
                id: `memory_${m.id}`,
                memoryId: m.id,
                date_key: m.date_key,
                title: m.title,
                imageCount: m.images?.length || 0,
                location: m.location,
            }))

            // Build milestone items
            const milestoneItems: MilestoneItem[] = (milestoneData || []).map((ms: any) => ({
                type: 'milestone' as const,
                id: `ms_${ms.id}`,
                date_key: ms.happened_at,
                title: ms.title,
                kind: ms.kind,
            }))

            // Build date plan items
            const datePlanItems: DatePlanItem[] = (datePlanData || []).map((dc: any) => ({
                type: 'dateplan' as const,
                id: `dp_${dc.id}`,
                date_key: dc.planned_for,
                ideaTitle: dc.date_ideas?.title || 'Date idea',
                status: dc.status,
            }))

            // Combine & sort: group by date_key, ordered by type priority
            const allItems: FeedItem[] = [...questionItems, ...journalItems, ...nudgeItems, ...eventItems, ...taskItems, ...memoryItems, ...milestoneItems, ...datePlanItems]
            allItems.sort((a, b) => {
                if (a.date_key !== b.date_key) return b.date_key.localeCompare(a.date_key)
                const priority: Record<string, number> = { question: 0, journal: 1, memory: 2, milestone: 3, event: 4, task: 5, dateplan: 6, nudge: 7 }
                return (priority[a.type] ?? 99) - (priority[b.type] ?? 99)
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
                <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
                <p className="text-sm text-zinc-400">{t('subtitle')}</p>
            </div>

            {/* YOUR TURN — unanswered questions where partner already answered */}
            {yourTurnItems.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-rose-500">
                        {t('yourTurn')} ({yourTurnItems.length})
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
                                        <p className="text-xs text-zinc-500">{format(parseISO(item.date_key), 'MMM d, yyyy', { locale: dateLoc })}</p>
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
                    {t('noHistory')}
                </div>
            ) : (
                <div className="space-y-6">
                    {dateGroups.map(({ dateKey, items }) => (
                        <div key={dateKey} className="space-y-2">
                            {/* Date header */}
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 sticky top-0 bg-zinc-950/90 backdrop-blur-sm py-1 z-10">
                                {(() => {
                                    const label = formatDateLabel(dateKey, dateLoc)
                                    if (label.type === 'today') return t('today')
                                    if (label.type === 'yesterday') return t('yesterday')
                                    return label.formatted
                                })()}
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
                                                        {q.lastMessage && (
                                                            <p className="text-xs text-zinc-500 truncate flex items-center gap-1">
                                                                <MessageCircle className="w-3 h-3 shrink-0" />
                                                                <span className="font-medium text-zinc-400">{q.isLastMessageMine ? t('you') : q.lastMessageBy}:</span>
                                                                {q.lastMessage}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-2">
                                                            {q.category && (
                                                                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                                                                    {q.category}
                                                                </span>
                                                            )}
                                                            {q.status === 'waiting' && (
                                                                <span className="text-[10px] text-amber-500">{t('waitingForPartner')}</span>
                                                            )}
                                                            {q.messageCount > 0 && (
                                                                <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
                                                                    <MessageCircle className="w-2.5 h-2.5" /> {q.messageCount}
                                                                </span>
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
                                                                {j.isMe ? t('you') : j.userName}
                                                            </span>
                                                            <span className="text-zinc-500">
                                                                {j.entryCount > 1 ? ` ${t('addedEntries', { count: j.entryCount })}` : ` ${t('addedAnEntry')}`}
                                                            </span>
                                                        </p>
                                                        {j.text && (
                                                            <p className="text-xs text-zinc-500 truncate">{j.text}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {j.entryCount > 1 && (
                                                            <span className="text-[10px] text-zinc-500">{j.entryCount}×</span>
                                                        )}
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
                                                            {n.isMe ? t('you') : n.senderName}
                                                        </span>
                                                        <span className="text-zinc-500"> {t('sentLove')}</span>
                                                    </p>
                                                    {n.message && (
                                                        <p className="text-xs text-zinc-500 truncate">{n.message}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    }

                                    if (item.type === 'event') {
                                        const e = item as EventItem
                                        return (
                                            <Link key={e.id} href={`/app/inbox/${e.date_key}`} className="block group">
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                                                    <CalendarDays className="w-4 h-4 text-blue-400 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{e.title}</p>
                                                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {e.all_day ? t('allDay') : format(parseISO(e.start_at), 'HH:mm')}
                                                            {e.location && <><MapPin className="w-3 h-3 ml-1" /> <span className="truncate">{e.location}</span></>}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Link>
                                        )
                                    }

                                    if (item.type === 'task') {
                                        const t = item as TaskItem
                                        return (
                                            <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
                                                {t.is_done
                                                    ? <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                                    : <CircleDashed className="w-4 h-4 text-zinc-600 shrink-0" />
                                                }
                                                <p className={`text-sm flex-1 truncate ${t.is_done ? 'text-zinc-500 line-through' : ''}`}>{t.title}</p>
                                                {t.due_at && !t.is_done && (
                                                    <span className="text-[10px] text-amber-400 shrink-0">{format(parseISO(t.due_at), 'MMM d')}</span>
                                                )}
                                            </div>
                                        )
                                    }

                                    if (item.type === 'memory') {
                                        const m = item as MemoryItem
                                        return (
                                            <Link key={m.id} href={`/app/memories/${m.memoryId}`} className="block group">
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/30 transition-colors">
                                                    <Star className="w-4 h-4 text-amber-400 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{m.title}</p>
                                                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                            {m.imageCount > 0 && <span className="flex items-center gap-0.5"><Camera className="w-3 h-3" /> {m.imageCount}</span>}
                                                            {m.location && <span className="flex items-center gap-0.5 truncate"><MapPin className="w-3 h-3 shrink-0" /> {m.location}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        )
                                    }

                                    if (item.type === 'milestone') {
                                        const ms = item as MilestoneItem
                                        return (
                                            <div key={ms.id} className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                                                <Trophy className="w-4 h-4 text-purple-400 shrink-0" />
                                                <p className="text-sm font-medium">{ms.title}</p>
                                            </div>
                                        )
                                    }

                                    if (item.type === 'dateplan') {
                                        const dp = item as DatePlanItem
                                        return (
                                            <div key={dp.id} className="flex items-center gap-3 p-3 rounded-xl bg-pink-500/5 border border-pink-500/10">
                                                <Lightbulb className={`w-4 h-4 shrink-0 ${dp.status === 'done' ? 'text-emerald-400' : 'text-pink-400'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{dp.ideaTitle}</p>
                                                    <p className="text-[10px] text-zinc-500">
                                                        {dp.status === 'done' ? t('dateCompleted') : t('datePlanned')}
                                                    </p>
                                                </div>
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
