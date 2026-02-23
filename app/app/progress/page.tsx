'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useToast } from '@/components/ui/toast'
import {
    format, differenceInDays, differenceInMonths, differenceInYears,
    parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
    subMonths, addMonths, isAfter, getMonth, getDate
} from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { CalendarHeart, Flame, Trophy, Activity, Calendar, ChevronLeft, ChevronRight, Sparkles, Plus, X, Star, BookOpen } from 'lucide-react'
import confetti from 'canvas-confetti'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const MOODS = [
    { id: 'great', emoji: '😄', label: 'Great' },
    { id: 'good', emoji: '🙂', label: 'Good' },
    { id: 'okay', emoji: '😐', label: 'Okay' },
    { id: 'low', emoji: '😔', label: 'Low' },
    { id: 'rough', emoji: '😢', label: 'Rough' },
] as const

const TIMEZONE = 'Europe/Oslo'

export default function ProgressPage() {
    const [stats, setStats] = useState<any>(null)
    const [room, setRoom] = useState<any>(null)
    const [activityMap, setActivityMap] = useState<any[]>([])
    const [answeredDates, setAnsweredDates] = useState<Record<string, string>>({})
    const [calMonth, setCalMonth] = useState(new Date())
    const [selectedSpecial, setSelectedSpecial] = useState<{ emoji: string; label: string } | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [myMood, setMyMood] = useState<string | null>(null)
    const [partnerMood, setPartnerMood] = useState<string | null>(null)
    const [isSavingMood, setIsSavingMood] = useState(false)
    const [roomId, setRoomId] = useState<string | null>(null)
    const confettiFired = useRef(false)

    // Milestones
    const [userMilestones, setUserMilestones] = useState<any[]>([])
    const [showMilestoneForm, setShowMilestoneForm] = useState(false)
    const [msKind, setMsKind] = useState('custom')
    const [msTitle, setMsTitle] = useState('')
    const [msDate, setMsDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [msNote, setMsNote] = useState('')
    const [isSavingMs, setIsSavingMs] = useState(false)

    const MILESTONE_KINDS = [
        { value: 'first_date', label: '☕ First Date' },
        { value: 'engagement', label: '💍 Engagement' },
        { value: 'moved_in', label: '🏠 Moved In' },
        { value: 'wedding', label: '💒 Wedding' },
        { value: 'custom', label: '✨ Custom' },
    ]

    const supabase = createClient()
    const { user } = useAuth()
    const router = useRouter()
    const { toast } = useToast()

    const dateKey = (() => {
        const now = new Date()
        const osloHour = parseInt(formatInTimeZone(now, TIMEZONE, 'HH'), 10)
        const businessDate = osloHour < 6 ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : now
        return formatInTimeZone(businessDate, TIMEZONE, 'yyyy-MM-dd')
    })()

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
                setRoomId(member.room_id)

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

                // 4. Load today's mood check-ins
                const { data: moodData } = await supabase
                    .from('mood_checkins')
                    .select('user_id, mood')
                    .eq('room_id', member.room_id)
                    .eq('date_key', dateKey)

                if (moodData) {
                    const myMoodEntry = moodData.find((m: any) => m.user_id === user.id)
                    const partnerMoodEntry = moodData.find((m: any) => m.user_id !== user.id)
                    if (myMoodEntry) setMyMood(myMoodEntry.mood)
                    if (partnerMoodEntry) setPartnerMood(partnerMoodEntry.mood)
                }

                // 4b. Load milestones
                const { data: msData } = await supabase
                    .from('milestones')
                    .select('*')
                    .eq('room_id', member.room_id)
                    .order('happened_at', { ascending: true })
                setUserMilestones(msData || [])

                // 5. Get all answered questions for calendar
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
    const milestones = [50, 100, 200, 365, 500, 730, 1000, 1095, 1461, 1826]
    const nextMilestone = milestones.find(m => m > totalDays)
    const daysToMilestone = nextMilestone ? nextMilestone - totalDays : null
    const hitMilestone = milestones.includes(totalDays)

    // Confetti on milestone day
    if (hitMilestone && !confettiFired.current) {
        confettiFired.current = true
        setTimeout(() => {
            confetti({
                particleCount: 150,
                spread: 90,
                origin: { y: 0.6 },
                colors: ['#f43f5e', '#ec4899', '#f97316', '#eab308', '#a855f7']
            })
        }, 500)
    }

    // Mood save handler
    const handleMoodSave = async (moodId: string) => {
        if (!user || !roomId || isSavingMood) return
        setIsSavingMood(true)
        const prev = myMood
        setMyMood(moodId)
        try {
            const { error } = await supabase
                .from('mood_checkins')
                .upsert({
                    room_id: roomId,
                    user_id: user.id,
                    mood: moodId,
                    date_key: dateKey,
                }, { onConflict: 'room_id, user_id, date_key' })
            if (error) throw error
            toast('Mood saved ✨', 'love')
        } catch (err: any) {
            setMyMood(prev)
            toast(err.message || 'Failed to save mood', 'error')
        } finally {
            setIsSavingMood(false)
        }
    }

    // Reversed activity (newest first)
    const reversedActivity = [...activityMap].reverse()

    // Milestone save
    const handleSaveMilestone = async () => {
        if (!user || !roomId || !msTitle.trim() || !msDate) return
        setIsSavingMs(true)
        try {
            const { error } = await supabase.from('milestones').insert({
                room_id: roomId,
                created_by: user.id,
                kind: msKind,
                title: msTitle.trim(),
                happened_at: msDate,
                note: msNote.trim() || null,
                images: [],
            })
            if (error) throw error
            toast('Milestone added 🏆', 'love')
            setShowMilestoneForm(false)
            setMsKind('custom'); setMsTitle(''); setMsDate(format(new Date(), 'yyyy-MM-dd')); setMsNote('')
            // Reload milestones
            const { data: msData } = await supabase
                .from('milestones').select('*').eq('room_id', roomId)
                .order('happened_at', { ascending: true })
            setUserMilestones(msData || [])
        } catch (err: any) {
            toast(err.message || 'Failed to save', 'error')
        } finally {
            setIsSavingMs(false)
        }
    }

    const handleDeleteMilestone = async (id: string) => {
        const { error } = await supabase.from('milestones').delete().eq('id', id)
        if (error) { toast('Failed to delete', 'error'); return }
        setUserMilestones(prev => prev.filter(m => m.id !== id))
        toast('Milestone deleted', 'success')
    }

    const currentYear = new Date().getFullYear()
    const currentMonth = format(new Date(), 'MM')

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

            {/* Milestone celebration */}
            {hitMilestone && (
                <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 border border-amber-500/20 rounded-2xl p-5 text-center space-y-2 animate-in fade-in zoom-in duration-500">
                    <div className="text-4xl">🎉</div>
                    <h3 className="text-lg font-bold text-amber-300">Milestone!</h3>
                    <p className="text-sm text-zinc-300">{totalDays} days together! Keep going! 💕</p>
                </div>
            )}

            {/* Mood Check-in */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> How are you feeling today?
                </h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between">
                        {MOODS.map(m => (
                            <button
                                key={m.id}
                                onClick={() => handleMoodSave(m.id)}
                                disabled={isSavingMood}
                                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-90 ${
                                    myMood === m.id
                                        ? 'bg-rose-500/10 ring-1 ring-rose-500/30 scale-105'
                                        : 'hover:bg-zinc-800'
                                }`}
                            >
                                <span className="text-2xl">{m.emoji}</span>
                                <span className="text-[10px] text-zinc-500">{m.label}</span>
                            </button>
                        ))}
                    </div>
                    {partnerMood && (
                        <div className="flex items-center justify-center gap-2 pt-2 border-t border-zinc-800">
                            <span className="text-xs text-zinc-500">Partner is feeling</span>
                            <span className="text-lg">{MOODS.find(m => m.id === partnerMood)?.emoji}</span>
                            <span className="text-xs text-zinc-400 font-medium">{MOODS.find(m => m.id === partnerMood)?.label}</span>
                        </div>
                    )}
                </div>
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
                            onClick={() => { setCalMonth(prev => subMonths(prev, 1)); setSelectedSpecial(null) }}
                            className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <h4 className="text-sm font-semibold">{format(calMonth, 'MMMM yyyy')}</h4>
                        <button
                            onClick={() => { setCalMonth(prev => addMonths(prev, 1)); setSelectedSpecial(null) }}
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
                            const isTappable = !!status || !!special

                            // Base styling based on answer status
                            const statusClass = status === 'both'
                                ? 'bg-rose-500/20 text-rose-400'
                                : status === 'partial'
                                    ? 'bg-zinc-700/30 text-zinc-400'
                                    : isFuture
                                        ? 'text-zinc-800'
                                        : 'text-zinc-600'

                            // Special date ring overlay (doesn't replace answer status)
                            const specialRing = special ? 'ring-1 ring-amber-500/50' : ''
                            const hoverClass = isTappable && !isFuture ? 'hover:brightness-125 cursor-pointer' : ''
                            const todayRing = isToday ? 'ring-1 ring-rose-500/50' : ''

                            return (
                                <button
                                    key={dateKey}
                                    onClick={() => {
                                        if (special) {
                                            setSelectedSpecial(special)
                                            // If there's also an answer, navigate after a brief moment
                                            if (status) {
                                                setTimeout(() => router.push(`/app/inbox/${dateKey}`), 1200)
                                            }
                                        } else if (status) {
                                            router.push(`/app/inbox/${dateKey}`)
                                        }
                                    }}
                                    disabled={!isTappable || (isFuture && !special)}
                                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all relative ${statusClass} ${specialRing} ${hoverClass} ${todayRing}`}
                                >
                                    {special ? (
                                        <span className="text-[11px] leading-none">{special.emoji}</span>
                                    ) : null}
                                    <span className={special ? 'text-[9px] leading-none' : ''}>{format(day, 'd')}</span>
                                    {/* Show answer dot on special dates that also have answers */}
                                    {special && status && (
                                        <span className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${status === 'both' ? 'bg-rose-400' : 'bg-zinc-400'}`} />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Special date popup */}
                    {selectedSpecial && (
                        <button
                            onClick={() => setSelectedSpecial(null)}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200"
                        >
                            <span className="text-base">{selectedSpecial.emoji}</span>
                            {selectedSpecial.label}
                            <span className="text-amber-500/50 text-xs ml-1">✕</span>
                        </button>
                    )}

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

            {/* Recap Links */}
            <div className="space-y-4 pt-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-500" /> Recap
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <Link
                        href={`/app/recap/${currentYear}/${currentMonth}`}
                        className="bg-gradient-to-br from-purple-500/10 to-zinc-900 border border-purple-500/20 rounded-2xl p-4 text-center hover:border-purple-500/40 transition-colors"
                    >
                        <p className="text-sm font-medium text-purple-400">This Month</p>
                        <p className="text-xs text-zinc-500 mt-1">{format(new Date(), 'MMMM')}</p>
                    </Link>
                    <Link
                        href={`/app/recap/${currentYear}`}
                        className="bg-gradient-to-br from-rose-500/10 to-zinc-900 border border-rose-500/20 rounded-2xl p-4 text-center hover:border-rose-500/40 transition-colors"
                    >
                        <p className="text-sm font-medium text-rose-400">This Year</p>
                        <p className="text-xs text-zinc-500 mt-1">{currentYear}</p>
                    </Link>
                </div>
            </div>

            {/* Milestones */}
            <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" /> Milestones
                    </h3>
                    <button
                        onClick={() => setShowMilestoneForm(true)}
                        className="flex items-center gap-1 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                </div>

                {userMilestones.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                        <Trophy className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
                        No milestones yet — add your first!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {userMilestones.map(ms => (
                            <div key={ms.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 group">
                                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                                    <Trophy className="w-4 h-4 text-amber-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{ms.title}</p>
                                    <p className="text-xs text-zinc-500">{format(parseISO(ms.happened_at), 'MMM d, yyyy')}</p>
                                    {ms.note && <p className="text-xs text-zinc-400 mt-1">{ms.note}</p>}
                                </div>
                                <button
                                    onClick={() => handleDeleteMilestone(ms.id)}
                                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-800 transition-all shrink-0"
                                    aria-label="Delete milestone"
                                >
                                    <X className="w-3.5 h-3.5 text-zinc-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Memories shortcut */}
            <Link
                href="/app/memories"
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors"
            >
                <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                    <Star className="w-4 h-4 text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Memories</p>
                    <p className="text-xs text-zinc-500">Browse your shared photo archive</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0" />
            </Link>

            {/* ═══ MILESTONE FORM MODAL ═══ */}
            {showMilestoneForm && (
                <div
                    className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => setShowMilestoneForm(false)}
                >
                    <div
                        className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">New Milestone</h3>
                            <button onClick={() => setShowMilestoneForm(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* Kind selector */}
                            <div className="flex gap-1.5 flex-wrap">
                                {MILESTONE_KINDS.map(k => (
                                    <button
                                        key={k.value}
                                        onClick={() => {
                                            setMsKind(k.value)
                                            if (k.value !== 'custom') setMsTitle(k.label.slice(2).trim())
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                            msKind === k.value ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400'
                                        }`}
                                    >
                                        {k.label}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                placeholder="Title *"
                                value={msTitle}
                                onChange={e => setMsTitle(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-zinc-600"
                                maxLength={120}
                            />
                            <div>
                                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">When?</label>
                                <input
                                    type="date"
                                    value={msDate}
                                    onChange={e => setMsDate(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 [color-scheme:dark]"
                                />
                            </div>
                            <textarea
                                placeholder="Note (optional)"
                                value={msNote}
                                onChange={e => setMsNote(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-zinc-600 resize-none min-h-[60px]"
                                maxLength={500}
                            />
                        </div>

                        <Button
                            onClick={handleSaveMilestone}
                            disabled={!msTitle.trim() || !msDate || isSavingMs}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isSavingMs ? 'Saving...' : 'Add milestone'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
