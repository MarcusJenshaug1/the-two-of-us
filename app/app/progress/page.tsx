'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import {
    format, differenceInDays, differenceInMonths, differenceInYears,
    parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
    subMonths, addMonths, isAfter, getMonth, getDate
} from 'date-fns'
import { CalendarHeart, Flame, Trophy, Activity, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

export default function ProgressPage() {
    const [stats, setStats] = useState<any>(null)
    const [room, setRoom] = useState<any>(null)
    const [activityMap, setActivityMap] = useState<any[]>([])
    const [answeredDates, setAnsweredDates] = useState<Record<string, string>>({})
    const [calMonth, setCalMonth] = useState(new Date())
    const [isLoading, setIsLoading] = useState(true)

    const supabase = createClient()
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!user) return
        let mounted = true

        const loadProgress = async () => {
            try {
                // 1. Get room
                const { data: member } = await supabase
                    .from('room_members')
                    .select('room_id, rooms(anniversary_date, created_at)')
                    .eq('user_id', user.id)
                    .single()

                if (!member) return
                const roomData = Array.isArray(member.rooms) ? member.rooms[0] : member.rooms
                setRoom(roomData)

                // 2. Get stats
                const { data: statsData } = await supabase
                    .from('stats')
                    .select('*')
                    .eq('room_id', member.room_id)
                    .single()

                setStats(statsData)

                // 3. Get activity data via RPC (last 90 days)
                const { data: activityData } = await supabase.rpc('get_activity_data', {
                    room_id_param: member.room_id,
                    user_id_param: user.id,
                    days_param: 90
                })

                if (activityData) {
                    setActivityMap(activityData)
                }

                // 4. Get all answered questions for calendar
                const { data: dqData } = await supabase
                    .from('daily_questions')
                    .select('date_key, answers(user_id)')
                    .eq('room_id', member.room_id)

                if (dqData) {
                    const dateMap: Record<string, string> = {}
                    for (const dq of dqData) {
                        const answers = dq.answers || []
                        const iAnswered = answers.some((a: any) => a.user_id === user.id)
                        const partnerAnswered = answers.some((a: any) => a.user_id !== user.id)
                        if (iAnswered && partnerAnswered) {
                            dateMap[dq.date_key] = 'both'
                        } else if (iAnswered || partnerAnswered) {
                            dateMap[dq.date_key] = 'partial'
                        }
                    }
                    setAnsweredDates(dateMap)
                }
            } catch (err) {
                console.error('Error loading progress', err)
            } finally {
                if (mounted) setIsLoading(false)
            }
        }

        loadProgress()
        return () => { mounted = false }
    }, [user, supabase])

    // Calendar days
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(calMonth)
        const monthEnd = endOfMonth(calMonth)
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
        const startDow = getDay(monthStart) // 0=Sun
        // Shift to Mon=0: (dow + 6) % 7
        const offset = (startDow + 6) % 7
        return { days, offset }
    }, [calMonth])

    // Special dates for the current calendar month
    const specialDates = useMemo(() => {
        const map: Record<string, { emoji: string; label: string }> = {}
        const year = calMonth.getFullYear()

        // Fixed celebrations (MM-DD -> emoji + label)
        const celebrations: { month: number; day: number; emoji: string; label: string }[] = [
            { month: 1, day: 1, emoji: '🎆', label: 'New Year' },
            { month: 2, day: 14, emoji: '💕', label: "Valentine's Day" },
            { month: 3, day: 8, emoji: '💐', label: "Women's Day" },
            { month: 5, day: 17, emoji: '🇳🇴', label: '17. mai' },
            { month: 12, day: 24, emoji: '🎄', label: 'Christmas Eve' },
            { month: 12, day: 25, emoji: '🎁', label: 'Christmas Day' },
            { month: 12, day: 31, emoji: '🥂', label: "New Year's Eve" },
        ]

        for (const c of celebrations) {
            if (getMonth(calMonth) + 1 === c.month) {
                const key = format(new Date(year, c.month - 1, c.day), 'yyyy-MM-dd')
                map[key] = { emoji: c.emoji, label: c.label }
            }
        }

        // Anniversary (same month/day each year)
        if (room?.anniversary_date) {
            const anniv = parseISO(room.anniversary_date)
            const annivMonth = getMonth(anniv) + 1
            const annivDay = getDate(anniv)
            if (getMonth(calMonth) + 1 === annivMonth) {
                const key = format(new Date(year, annivMonth - 1, annivDay), 'yyyy-MM-dd')
                const yearsCount = year - anniv.getFullYear()
                map[key] = {
                    emoji: '💍',
                    label: yearsCount > 0 ? `Anniversary (${yearsCount}y)` : 'Anniversary'
                }
            }
        }

        return map
    }, [calMonth, room?.anniversary_date])

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    // Calculate Time Together
    let timeStr = "Just started!"
    let totalDays = 0
    if (room?.anniversary_date) {
        const start = parseISO(room.anniversary_date)
        const now = new Date()
        totalDays = differenceInDays(now, start)
        const years = differenceInYears(now, start)
        const months = differenceInMonths(now, start) % 12
        const days = differenceInDays(now, new Date(start.getFullYear() + years, start.getMonth() + months, start.getDate()))

        const timeParts: string[] = []
        if (years > 0) timeParts.push(`${years}y`)
        if (months > 0) timeParts.push(`${months}m`)
        if (days > 0 || timeParts.length === 0) timeParts.push(`${days}d`)
        timeStr = timeParts.join(' ')
    }

    // Calculate Next Milestone
    const milestones = [100, 200, 365, 500, 1000]
    const nextMilestone = milestones.find(m => m > totalDays)
    const daysToMilestone = nextMilestone ? nextMilestone - totalDays : null

    // Reversed activity (newest first)
    const reversedActivity = [...activityMap].reverse()

    return (
        <div className="p-4 space-y-8 pt-8 md:pt-12 pb-24">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
                <p className="text-sm text-zinc-400">Your journey together.</p>
            </div>

            {/* Time Together Card */}
            <div className="bg-gradient-to-br from-rose-500/20 to-zinc-900 border border-rose-500/20 rounded-3xl p-6 text-center space-y-2 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 text-rose-500/10">
                    <CalendarHeart className="w-40 h-40" />
                </div>
                <p className="text-sm font-medium text-rose-400 uppercase tracking-widest relative z-10">Together for</p>
                <h2 className="text-4xl font-bold tracking-tight relative z-10">{timeStr}</h2>
                <p className="text-sm text-zinc-400 relative z-10">{totalDays} total days</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                        <Flame className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="text-2xl font-semibold">{stats?.current_streak || 0}</p>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Current Streak</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                        <Trophy className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-semibold">{stats?.best_streak || 0}</p>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Best Streak</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                        <Activity className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-semibold">{stats?.total_answered || 0}</p>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Answered</p>
                </div>

                {daysToMilestone && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                        </div>
                        <p className="text-2xl font-semibold">{daysToMilestone}</p>
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Days to {nextMilestone}</p>
                    </div>
                )}
            </div>

            {/* Calendar View */}
            <div className="space-y-4 pt-4">
                <h3 className="font-semibold text-lg">Calendar</h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setCalMonth(prev => subMonths(prev, 1))}
                            className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <h4 className="text-sm font-semibold">{format(calMonth, 'MMMM yyyy')}</h4>
                        <button
                            onClick={() => setCalMonth(prev => addMonths(prev, 1))}
                            className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                            <div key={d} className="text-center text-[10px] font-medium text-zinc-600 uppercase">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Empty offset cells */}
                        {Array.from({ length: calendarDays.offset }).map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square" />
                        ))}

                        {calendarDays.days.map(day => {
                            const dateKey = format(day, 'yyyy-MM-dd')
                            const status = answeredDates[dateKey]
                            const special = specialDates[dateKey]
                            const isToday = dateKey === format(new Date(), 'yyyy-MM-dd')
                            const isFuture = isAfter(day, new Date())

                            return (
                                <button
                                    key={dateKey}
                                    onClick={() => {
                                        if (status) router.push(`/app/inbox/${dateKey}`)
                                    }}
                                    disabled={!status || isFuture}
                                    title={special?.label}
                                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all relative ${
                                        special
                                            ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30'
                                            : status === 'both'
                                                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 cursor-pointer'
                                                : status === 'partial'
                                                    ? 'bg-zinc-700/30 text-zinc-400 hover:bg-zinc-700/50 cursor-pointer'
                                                    : isFuture
                                                        ? 'text-zinc-800'
                                                        : 'text-zinc-600'
                                    } ${isToday ? 'ring-1 ring-rose-500/50' : ''}`}
                                >
                                    {special ? (
                                        <span className="text-[11px] leading-none">{special.emoji}</span>
                                    ) : null}
                                    <span className={special ? 'text-[9px] leading-none' : ''}>{format(day, 'd')}</span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-end flex-wrap gap-3 mt-4 text-xs text-zinc-500">
                        <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-rose-500/40 mr-1.5" /> Both answered</div>
                        <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-zinc-700/50 mr-1.5" /> Partial</div>
                        <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-amber-500/30 ring-1 ring-amber-500/30 mr-1.5" /> Special</div>
                    </div>
                </div>
            </div>

            {/* Activity Heatmap - newest first */}
            <div className="space-y-4 pt-4">
                <h3 className="font-semibold text-lg">Last 90 Days Activity</h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 overflow-x-auto">
                    {reversedActivity.length > 0 ? (
                        <div className="flex gap-1">
                            {reversedActivity.map((day, i) => (
                                <div
                                    key={i}
                                    className={`w-3 h-12 rounded-sm flex-shrink-0 ${day.status === 'both_answered' ? 'bg-rose-500' :
                                            day.status === 'you_answered' ? 'bg-zinc-600' :
                                                'bg-zinc-800'
                                        }`}
                                    title={`${day.date_key}: ${day.status}`}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-zinc-500 text-center py-4">
                            Activity data requires the get_activity_data RPC function to be deployed.
                        </p>
                    )}
                    <div className="flex items-center justify-between mt-6 text-xs text-zinc-500">
                        <span>Newest</span>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-zinc-800 mr-2" /> Missed</div>
                            <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-zinc-600 mr-2" /> Partial</div>
                            <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-rose-500 mr-2" /> Completed</div>
                        </div>
                        <span>Oldest</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
