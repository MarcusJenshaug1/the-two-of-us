'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import Link from 'next/link'
import {
    ArrowLeft, Heart, MessageSquare, Smile, Star,
    MapPin, Tag, ChevronRight, Trophy, Lightbulb
} from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'

const MOODS: Record<string, { emoji: string; label: string }> = {
    great: { emoji: '😄', label: 'Great' },
    good: { emoji: '🙂', label: 'Good' },
    okay: { emoji: '😐', label: 'Okay' },
    low: { emoji: '😔', label: 'Low' },
    rough: { emoji: '😢', label: 'Rough' },
}

export default function MonthRecapPage() {
    const { year, month } = useParams<{ year: string; month: string }>()
    const yearNum = parseInt(year, 10)
    const monthNum = parseInt(month, 10)
    const monthDate = new Date(yearNum, monthNum - 1, 1)
    const dateStart = format(startOfMonth(monthDate), 'yyyy-MM-dd')
    const dateEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd')
    const monthLabel = format(monthDate, 'MMMM yyyy')

    const [daysWithBothAnswers, setDaysWithBothAnswers] = useState(0)
    const [totalNudges, setTotalNudges] = useState(0)
    const [moodBreakdown, setMoodBreakdown] = useState<Record<string, number>>({})
    const [topTags, setTopTags] = useState<{ tag: string; count: number }[]>([])
    const [highlights, setHighlights] = useState<any[]>([])
    const [milestones, setMilestones] = useState<any[]>([])
    const [totalMemories, setTotalMemories] = useState(0)
    const [datesPlanned, setDatesPlanned] = useState(0)
    const [datesDone, setDatesDone] = useState(0)
    const [topDateCategories, setTopDateCategories] = useState<{ category: string; count: number }[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const supabase = createClient()
    const { user } = useAuth()

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

            let both = 0
            if (dqData) {
                for (const dq of dqData) {
                    const users = new Set((dq.answers || []).map((a: any) => a.user_id))
                    if (users.size >= 2) both++
                }
            }
            setDaysWithBothAnswers(both)

            // 2. Nudges
            const { count } = await supabase
                .from('nudges')
                .select('id', { count: 'exact', head: true })
                .eq('room_id', rid)
                .gte('date_key', dateStart)
                .lte('date_key', dateEnd)
            setTotalNudges(count || 0)

            // 3. Mood
            const { data: moodData } = await supabase
                .from('mood_checkins')
                .select('mood')
                .eq('room_id', rid)
                .gte('date_key', dateStart)
                .lte('date_key', dateEnd)

            const mb: Record<string, number> = {}
            if (moodData) {
                for (const m of moodData) {
                    mb[m.mood] = (mb[m.mood] || 0) + 1
                }
            }
            setMoodBreakdown(mb)

            // 4. Memories
            const { data: memData } = await supabase
                .from('memories')
                .select('id, title, happened_at, images, location, tags')
                .eq('room_id', rid)
                .gte('happened_at', dateStart)
                .lte('happened_at', dateEnd)
                .order('happened_at', { ascending: true })

            setTotalMemories(memData?.length || 0)

            const tc: Record<string, number> = {}
            if (memData) {
                for (const m of memData) {
                    for (const t of m.tags) tc[t] = (tc[t] || 0) + 1
                }
            }
            setTopTags(Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => ({ tag, count })))

            // Highlights — spread from start/middle/end of month
            if (memData && memData.length > 0) {
                const { data: favData } = await supabase
                    .from('memory_favorites')
                    .select('memory_id')
                    .eq('room_id', rid)
                    .eq('user_id', user.id)
                const favIds = new Set((favData || []).map((f: any) => f.memory_id))
                const favMems = memData.filter(m => favIds.has(m.id))

                if (favMems.length >= 3) {
                    setHighlights([favMems[0], favMems[Math.floor(favMems.length / 2)], favMems[favMems.length - 1]])
                } else {
                    const step = Math.max(1, Math.floor(memData.length / 3))
                    const indices = [...new Set([0, Math.min(step, memData.length - 1), Math.min(step * 2, memData.length - 1)])]
                    setHighlights(indices.map(i => memData[i]))
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
            setMilestones(msData || [])

            // 6. Date completions
            const { data: dcData } = await supabase
                .from('date_completions')
                .select('status, date_ideas(category)')
                .eq('room_id', rid)
                .gte('created_at', `${dateStart}T00:00:00`)
                .lte('created_at', `${dateEnd}T23:59:59`)

            let dp = 0, dd = 0
            const dcc: Record<string, number> = {}
            if (dcData) {
                for (const dc of dcData as any[]) {
                    if (dc.status === 'planned' || dc.status === 'done') dp++
                    if (dc.status === 'done') { dd++; const cat = dc.date_ideas?.category; if (cat) dcc[cat] = (dcc[cat] || 0) + 1 }
                }
            }
            setDatesPlanned(dp)
            setDatesDone(dd)
            setTopDateCategories(Object.entries(dcc).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([category, count]) => ({ category, count })))

        } catch (err) {
            console.error('Month recap error', err)
        } finally {
            setIsLoading(false)
        }
    }, [user, supabase, dateStart, dateEnd])

    useEffect(() => { loadRecap() }, [loadRecap])

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    const totalMoods = Object.values(moodBreakdown).reduce((s, v) => s + v, 0)

    return (
        <div className="p-4 space-y-6 pt-8 md:pt-12 pb-24 animate-in fade-in">
            <Link href={`/app/recap/${year}`} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                <ArrowLeft className="w-4 h-4" /> {year} Recap
            </Link>

            {/* Hero */}
            <div className="bg-gradient-to-br from-purple-500/20 via-rose-500/10 to-zinc-900 border border-purple-500/20 rounded-3xl p-6 text-center space-y-2">
                <p className="text-sm font-medium text-purple-400 uppercase tracking-widest">Monthly Recap</p>
                <h1 className="text-3xl font-bold tracking-tight">{monthLabel}</h1>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center space-y-1">
                    <MessageSquare className="w-5 h-5 text-rose-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{daysWithBothAnswers}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Days both answered</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center space-y-1">
                    <Heart className="w-5 h-5 text-pink-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{totalNudges}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Love nudges</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center space-y-1">
                    <Star className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{totalMemories}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Memories</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center space-y-1">
                    <Trophy className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{milestones.length}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Milestones</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center space-y-1">
                    <Lightbulb className="w-5 h-5 text-purple-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{datesDone}<span className="text-sm text-zinc-600">/{datesPlanned}</span></p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Dates done</p>
                </div>
            </div>

            {/* Mood summary */}
            {totalMoods > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Mood Overview</h3>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                        {Object.entries(moodBreakdown)
                            .sort((a, b) => b[1] - a[1])
                            .map(([mood, count]) => {
                                const m = MOODS[mood]
                                const pct = Math.round((count / totalMoods) * 100)
                                return (
                                    <div key={mood} className="flex items-center gap-3">
                                        <span className="text-lg w-7 text-center">{m?.emoji || '❓'}</span>
                                        <div className="flex-1">
                                            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                                                <div className="h-full rounded-full bg-purple-500/60" style={{ width: `${pct}%` }} />
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
            {topTags.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Top Tags</h3>
                    <div className="flex gap-2 flex-wrap">
                        {topTags.map(({ tag, count }) => (
                            <span key={tag} className="flex items-center gap-1 text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 px-3 py-1.5 rounded-full">
                                <Tag className="w-3 h-3" /> {tag} <span className="text-zinc-600">×{count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Highlights */}
            {highlights.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Highlights</h3>
                    <div className="space-y-2">
                        {highlights.map((mem: any) => (
                            <Link
                                key={mem.id}
                                href={`/app/memories/${mem.id}`}
                                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 hover:border-zinc-700 transition-colors"
                            >
                                {mem.images?.length > 0 ? (
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

            {/* Date categories */}
            {topDateCategories.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Date Night Favorites</h3>
                    <div className="flex gap-2 flex-wrap">
                        {topDateCategories.map(({ category, count }) => (
                            <span key={category} className="flex items-center gap-1.5 text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 px-3 py-1.5 rounded-full">
                                <Lightbulb className="w-3 h-3" /> {category} <span className="text-zinc-600">×{count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Milestones */}
            {milestones.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Milestones</h3>
                    <div className="space-y-2">
                        {milestones.map((ms: any) => (
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
        </div>
    )
}
