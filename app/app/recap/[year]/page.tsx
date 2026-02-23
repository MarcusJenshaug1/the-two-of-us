'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import Link from 'next/link'
import {
    ArrowLeft, Calendar, Heart, MessageSquare, Smile, Star,
    MapPin, Tag, ChevronRight, Trophy
} from 'lucide-react'
import { format, parseISO, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

const TIMEZONE = 'Europe/Oslo'

const MOODS: Record<string, { emoji: string; label: string }> = {
    great: { emoji: '😄', label: 'Great' },
    good: { emoji: '🙂', label: 'Good' },
    okay: { emoji: '😐', label: 'Okay' },
    low: { emoji: '😔', label: 'Low' },
    rough: { emoji: '😢', label: 'Rough' },
}

type RecapData = {
    daysWithBothAnswers: number
    totalNudges: number
    moodBreakdown: Record<string, number>
    topTags: { tag: string; count: number }[]
    highlights: { id: string; title: string; happened_at: string; images: string[]; location: string | null }[]
    milestones: { id: string; title: string; kind: string; happened_at: string }[]
    totalMemories: number
}

export default function YearRecapPage() {
    const { year } = useParams<{ year: string }>()
    const yearNum = parseInt(year, 10)
    const [data, setData] = useState<RecapData | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const supabase = createClient()
    const { user } = useAuth()

    const dateStart = `${year}-01-01`
    const dateEnd = `${year}-12-31`

    const loadRecap = useCallback(async () => {
        if (!user) return
        try {
            setIsLoading(true)
            const { data: member } = await supabase
                .from('room_members').select('room_id').eq('user_id', user.id).single()
            if (!member) return
            const rid = member.room_id

            // 1. Days with both answers
            const { data: dqData } = await supabase
                .from('daily_questions')
                .select('date_key, answers(user_id)')
                .eq('room_id', rid)
                .gte('date_key', dateStart)
                .lte('date_key', dateEnd)

            let daysWithBothAnswers = 0
            if (dqData) {
                for (const dq of dqData) {
                    const users = new Set((dq.answers || []).map((a: any) => a.user_id))
                    if (users.size >= 2) daysWithBothAnswers++
                }
            }

            // 2. Nudges count
            const { count: nudgeCount } = await supabase
                .from('nudges')
                .select('id', { count: 'exact', head: true })
                .eq('room_id', rid)
                .gte('date_key', dateStart)
                .lte('date_key', dateEnd)

            // 3. Mood breakdown
            const { data: moodData } = await supabase
                .from('mood_checkins')
                .select('mood')
                .eq('room_id', rid)
                .gte('date_key', dateStart)
                .lte('date_key', dateEnd)

            const moodBreakdown: Record<string, number> = {}
            if (moodData) {
                for (const m of moodData) {
                    moodBreakdown[m.mood] = (moodBreakdown[m.mood] || 0) + 1
                }
            }

            // 4. Memories for tags + highlights
            const { data: memData } = await supabase
                .from('memories')
                .select('id, title, happened_at, images, location, tags')
                .eq('room_id', rid)
                .gte('happened_at', dateStart)
                .lte('happened_at', dateEnd)
                .order('happened_at', { ascending: true })

            const tagCounts: Record<string, number> = {}
            if (memData) {
                for (const m of memData) {
                    for (const t of m.tags) {
                        tagCounts[t] = (tagCounts[t] || 0) + 1
                    }
                }
            }
            const topTags = Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([tag, count]) => ({ tag, count }))

            // Highlights: pick favorites first, then spread across year
            let highlights: RecapData['highlights'] = []
            if (memData && memData.length > 0) {
                // Try favorites first
                const { data: favData } = await supabase
                    .from('memory_favorites')
                    .select('memory_id')
                    .eq('room_id', rid)
                    .eq('user_id', user.id)

                const favIds = new Set((favData || []).map((f: any) => f.memory_id))
                const favMems = memData.filter(m => favIds.has(m.id))

                if (favMems.length >= 3) {
                    // Spread across the year: pick from beginning, middle, end
                    highlights = [favMems[0], favMems[Math.floor(favMems.length / 2)], favMems[favMems.length - 1]]
                } else {
                    // Spread evenly across all memories
                    const step = Math.max(1, Math.floor(memData.length / 3))
                    const indices = [0, Math.min(step, memData.length - 1), Math.min(step * 2, memData.length - 1)]
                    highlights = [...new Set(indices)].map(i => memData[i])
                }
            }

            // 5. Milestones
            const { data: msData } = await supabase
                .from('milestones')
                .select('id, title, kind, happened_at')
                .eq('room_id', rid)
                .gte('happened_at', dateStart)
                .lte('happened_at', dateEnd)
                .order('happened_at', { ascending: true })

            setData({
                daysWithBothAnswers,
                totalNudges: nudgeCount || 0,
                moodBreakdown,
                topTags,
                highlights,
                milestones: msData || [],
                totalMemories: memData?.length || 0,
            })
        } catch (err) {
            console.error('Recap load error', err)
        } finally {
            setIsLoading(false)
        }
    }, [user, supabase, dateStart, dateEnd])

    useEffect(() => { loadRecap() }, [loadRecap])

    const months = eachMonthOfInterval({ start: startOfYear(new Date(yearNum, 0)), end: endOfYear(new Date(yearNum, 0)) })

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    const totalMoods = Object.values(data?.moodBreakdown || {}).reduce((s, v) => s + v, 0)

    return (
        <div className="p-4 space-y-6 pt-8 md:pt-12 pb-24 animate-in fade-in">
            <Link href="/app/progress" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Progress
            </Link>

            {/* Hero */}
            <div className="bg-gradient-to-br from-rose-500/20 via-purple-500/10 to-zinc-900 border border-rose-500/20 rounded-3xl p-6 text-center space-y-2">
                <p className="text-sm font-medium text-rose-400 uppercase tracking-widest">Year in Review</p>
                <h1 className="text-4xl font-bold tracking-tight">{year}</h1>
                <p className="text-sm text-zinc-400">Your year together, in numbers.</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center space-y-1">
                    <MessageSquare className="w-5 h-5 text-rose-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{data?.daysWithBothAnswers || 0}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Days both answered</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center space-y-1">
                    <Heart className="w-5 h-5 text-pink-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{data?.totalNudges || 0}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Love nudges</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center space-y-1">
                    <Star className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{data?.totalMemories || 0}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Memories saved</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center space-y-1">
                    <Trophy className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{data?.milestones.length || 0}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Milestones</p>
                </div>
            </div>

            {/* Mood summary */}
            {totalMoods > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Mood Overview</h3>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                        {Object.entries(data?.moodBreakdown || {})
                            .sort((a, b) => b[1] - a[1])
                            .map(([mood, count]) => {
                                const m = MOODS[mood]
                                const pct = Math.round((count / totalMoods) * 100)
                                return (
                                    <div key={mood} className="flex items-center gap-3">
                                        <span className="text-lg w-7 text-center">{m?.emoji || '❓'}</span>
                                        <div className="flex-1">
                                            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                                                <div className="h-full rounded-full bg-rose-500/60" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                        <span className="text-xs text-zinc-500 w-10 text-right">{pct}%</span>
                                    </div>
                                )
                            })}
                    </div>
                </div>
            )}

            {/* Top tags */}
            {data && data.topTags.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Top Tags</h3>
                    <div className="flex gap-2 flex-wrap">
                        {data.topTags.map(({ tag, count }) => (
                            <span key={tag} className="flex items-center gap-1 text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 px-3 py-1.5 rounded-full">
                                <Tag className="w-3 h-3" /> {tag} <span className="text-zinc-600">×{count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Highlights */}
            {data && data.highlights.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Highlights</h3>
                    <div className="space-y-2">
                        {data.highlights.map(mem => (
                            <Link
                                key={mem.id}
                                href={`/app/memories/${mem.id}`}
                                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 hover:border-zinc-700 transition-colors"
                            >
                                {mem.images.length > 0 ? (
                                    <img src={mem.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                                        <Star className="w-5 h-5 text-zinc-600" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0 space-y-0.5">
                                    <p className="text-sm font-medium truncate">{mem.title}</p>
                                    <p className="text-xs text-zinc-500">
                                        {format(parseISO(mem.happened_at), 'MMM d')}
                                        {mem.location && <> · {mem.location}</>}
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0" />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Milestones */}
            {data && data.milestones.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Milestones</h3>
                    <div className="space-y-2">
                        {data.milestones.map(ms => (
                            <div key={ms.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{ms.title}</p>
                                    <p className="text-xs text-zinc-500">{format(parseISO(ms.happened_at), 'MMM d, yyyy')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Month links */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Browse by Month</h3>
                <div className="grid grid-cols-3 gap-2">
                    {months.map(m => (
                        <Link
                            key={format(m, 'MM')}
                            href={`/app/recap/${year}/${format(m, 'MM')}`}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl py-3 text-center text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                        >
                            {format(m, 'MMM')}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
