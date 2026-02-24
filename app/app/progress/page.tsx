'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useTranslations, useLocale } from '@/lib/i18n'
import { getDateLocale } from '@/lib/i18n/date-locale'
import {
    format, differenceInDays, differenceInMonths, differenceInYears,
    parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
    subMonths, addMonths, isAfter, getMonth, getDate
} from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { CalendarHeart, Flame, Trophy, Activity, Calendar, ChevronLeft, ChevronRight, Sparkles, Plus, X, Star, BookOpen, Lightbulb, Pencil } from 'lucide-react'
import confetti from 'canvas-confetti'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const MOODS = [
    { id: 'great', emoji: '😄', labelKey: 'moodGreat' },
    { id: 'good', emoji: '🙂', labelKey: 'moodGood' },
    { id: 'okay', emoji: '😐', labelKey: 'moodOkay' },
    { id: 'low', emoji: '😔', labelKey: 'moodLow' },
    { id: 'rough', emoji: '😢', labelKey: 'moodRough' },
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
    const [dayBadges, setDayBadges] = useState<Record<string, string[]>>({})
    const [journalCounts, setJournalCounts] = useState<Record<string, number>>({})

    // Milestones
    const [userMilestones, setUserMilestones] = useState<any[]>([])
    const [showMilestoneForm, setShowMilestoneForm] = useState(false)
    const [editingMilestone, setEditingMilestone] = useState<any | null>(null)
    const [msKind, setMsKind] = useState('custom')
    const [msTitle, setMsTitle] = useState('')
    const [msDate, setMsDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [msNote, setMsNote] = useState('')
    const [isSavingMs, setIsSavingMs] = useState(false)

    const MILESTONE_KINDS = [
        { value: 'first_date', labelKey: 'kindFirstDate' },
        { value: 'engagement', labelKey: 'kindEngagement' },
        { value: 'moved_in', labelKey: 'kindMovedIn' },
        { value: 'wedding', labelKey: 'kindWedding' },
        { value: 'custom', labelKey: 'kindCustom' },
    ]

    const supabase = createClient()
    const { user } = useAuth()
    const router = useRouter()
    const { toast } = useToast()
    const t = useTranslations('progress')
    const { locale } = useLocale()
    const dateLoc = getDateLocale(locale)

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

    // Load calendar content badges per month
    useEffect(() => {
        if (!roomId) return
        const mStart = format(startOfMonth(calMonth), 'yyyy-MM-dd')
        const mEnd = format(endOfMonth(calMonth), 'yyyy-MM-dd')

        const loadBadges = async () => {
            const [evR, tkR, memR, dpR, logR] = await Promise.all([
                supabase.from('shared_events').select('date_key').eq('room_id', roomId).gte('date_key', mStart).lte('date_key', mEnd),
                supabase.from('shared_tasks').select('due_date_key').eq('room_id', roomId).not('due_date_key', 'is', null).gte('due_date_key', mStart).lte('due_date_key', mEnd),
                supabase.from('memories').select('date_key').eq('room_id', roomId).gte('date_key', mStart).lte('date_key', mEnd),
                supabase.from('date_completions').select('planned_for').eq('room_id', roomId).not('planned_for', 'is', null).gte('planned_for', mStart).lte('planned_for', mEnd).neq('status', 'skipped'),
                supabase.from('daily_logs').select('date_key').eq('room_id', roomId).gte('date_key', mStart).lte('date_key', mEnd),
            ])

            const badges: Record<string, string[]> = {}
            const jCounts: Record<string, number> = {}
            const add = (dk: string, type: string) => {
                if (!badges[dk]) badges[dk] = []
                if (!badges[dk].includes(type)) badges[dk].push(type)
            }

            for (const e of evR.data || []) add(e.date_key, 'event')
            for (const t of tkR.data || []) if (t.due_date_key) add(t.due_date_key, 'task')
            for (const m of memR.data || []) add(m.date_key, 'memory')
            for (const d of dpR.data || []) if (d.planned_for) add(d.planned_for, 'dateplan')
            for (const l of logR.data || []) {
                add(l.date_key, 'journal')
                jCounts[l.date_key] = (jCounts[l.date_key] || 0) + 1
            }

            for (const ms of userMilestones) {
                if (ms.happened_at >= mStart && ms.happened_at <= mEnd) {
                    add(ms.happened_at, 'milestone')
                }
            }

            setDayBadges(badges)
            setJournalCounts(jCounts)
        }

        loadBadges()
    }, [calMonth, roomId, supabase, userMilestones])

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
        const celebrations: { month: number; day: number; emoji: string; labelKey: string }[] = [
            { month: 1, day: 1, emoji: '🎆', labelKey: 'newYear' },
            { month: 2, day: 14, emoji: '💕', labelKey: 'valentinesDay' },
            { month: 3, day: 8, emoji: '💐', labelKey: 'womensDay' },
            { month: 5, day: 17, emoji: '🇳🇴', labelKey: 'syttendeMai' },
            { month: 12, day: 24, emoji: '🎄', labelKey: 'christmasEve' },
            { month: 12, day: 25, emoji: '🎁', labelKey: 'christmasDay' },
            { month: 12, day: 31, emoji: '🥂', labelKey: 'newYearsEve' },
        ]

        for (const c of celebrations) {
            if (getMonth(calMonth) + 1 === c.month) {
                const key = format(new Date(year, c.month - 1, c.day), 'yyyy-MM-dd')
                map[key] = { emoji: c.emoji, label: t(c.labelKey) }
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
                    label: yearsCount > 0 ? t('anniversaryYears', { count: yearsCount }) : t('anniversary')
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
    let timeStr = t('justStarted')
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
            toast(t('moodSaved'), 'love')
        } catch (err: any) {
            setMyMood(prev)
            toast(err.message || t('failedSaveMood'), 'error')
        } finally {
            setIsSavingMood(false)
        }
    }

    // Reversed activity (newest first)
    const reversedActivity = [...activityMap].reverse()

    // Milestone save
    const openEditMilestone = (ms: any) => {
        setEditingMilestone(ms)
        setMsKind(ms.kind)
        setMsTitle(ms.title)
        setMsDate(ms.happened_at)
        setMsNote(ms.note || '')
        setShowMilestoneForm(true)
    }

    const handleSaveMilestone = async () => {
        if (!user || !roomId || !msTitle.trim() || !msDate) return
        setIsSavingMs(true)
        try {
            if (editingMilestone) {
                const { error } = await supabase.from('milestones').update({
                    kind: msKind,
                    title: msTitle.trim(),
                    happened_at: msDate,
                    note: msNote.trim() || null,
                }).eq('id', editingMilestone.id)
                if (error) throw error
                toast(t('milestoneUpdated'), 'love')
            } else {
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
                toast(t('milestoneAdded'), 'love')
            }
            setShowMilestoneForm(false)
            setEditingMilestone(null)
            setMsKind('custom'); setMsTitle(''); setMsDate(format(new Date(), 'yyyy-MM-dd')); setMsNote('')
            // Reload milestones
            const { data: msData } = await supabase
                .from('milestones').select('*').eq('room_id', roomId)
                .order('happened_at', { ascending: true })
            setUserMilestones(msData || [])
        } catch (err: any) {
            toast(err.message || t('failedSave'), 'error')
        } finally {
            setIsSavingMs(false)
        }
    }

    const handleDeleteMilestone = async (id: string) => {
        const { error } = await supabase.from('milestones').delete().eq('id', id)
        if (error) { toast(t('failedDelete'), 'error'); return }
        setUserMilestones(prev => prev.filter(m => m.id !== id))
        toast(t('milestoneDeleted'), 'success')
    }

    const currentYear = new Date().getFullYear()
    const currentMonth = format(new Date(), 'MM')

    return (
        <div className="p-4 space-y-8 pt-8 md:pt-12 pb-24">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
                <p className="text-sm text-zinc-400">{t('subtitle')}</p>
            </div>

            {/* Time Together Card */}
            <div className="bg-gradient-to-br from-rose-500/20 to-zinc-900 border border-rose-500/20 rounded-3xl p-6 text-center space-y-2 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 text-rose-500/10">
                    <CalendarHeart className="w-40 h-40" />
                </div>
                <p className="text-sm font-medium text-rose-400 uppercase tracking-widest relative z-10">{t('togetherFor')}</p>
                <h2 className="text-4xl font-bold tracking-tight relative z-10">{timeStr}</h2>
                <p className="text-sm text-zinc-400 relative z-10">{t('totalDays', { count: totalDays })}</p>
            </div>

            {/* Milestone celebration */}
            {hitMilestone && (
                <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 border border-amber-500/20 rounded-2xl p-5 text-center space-y-2 animate-in fade-in zoom-in duration-500">
                    <div className="text-4xl">🎉</div>
                    <h3 className="text-lg font-bold text-amber-300">{t('milestoneTitle')}</h3>
                    <p className="text-sm text-zinc-300">{t('milestoneCelebration', { count: totalDays })}</p>
                </div>
            )}

            {/* Mood Check-in */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> {t('moodTitle')}
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
                                <span className="text-[10px] text-zinc-500">{t(m.labelKey)}</span>
                            </button>
                        ))}
                    </div>
                    {partnerMood && (
                        <div className="flex items-center justify-center gap-2 pt-2 border-t border-zinc-800">
                            <span className="text-xs text-zinc-500">{t('partnerFeeling')}</span>
                            <span className="text-lg">{MOODS.find(m => m.id === partnerMood)?.emoji}</span>
                            <span className="text-xs text-zinc-400 font-medium">{MOODS.find(m => m.id === partnerMood)?.labelKey ? t(MOODS.find(m => m.id === partnerMood)!.labelKey) : ''}</span>
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
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{t('currentStreak')}</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                        <Trophy className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-semibold">{stats?.best_streak || 0}</p>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{t('bestStreak')}</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                        <Activity className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-semibold">{stats?.total_answered || 0}</p>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{t('totalAnswered')}</p>
                </div>

                {daysToMilestone && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                        </div>
                        <p className="text-2xl font-semibold">{daysToMilestone}</p>
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{t('daysTo', { milestone: nextMilestone! })}</p>
                    </div>
                )}
            </div>

            {/* Calendar View */}
            <div className="space-y-4 pt-4">
                <h3 className="font-semibold text-lg">{t('calendar')}</h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => { setCalMonth(prev => subMonths(prev, 1)); setSelectedSpecial(null) }}
                            className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3">
                            <h4 className="text-sm font-semibold">{format(calMonth, 'MMMM yyyy', { locale: dateLoc })}</h4>
                            {format(calMonth, 'yyyy-MM') !== format(new Date(), 'yyyy-MM') && (
                                <button
                                    onClick={() => { setCalMonth(new Date()); setSelectedSpecial(null) }}
                                    className="text-xs font-medium px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                                >
                                    {t('today')}
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => { setCalMonth(prev => addMonths(prev, 1)); setSelectedSpecial(null) }}
                            className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {(['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'] as const).map(d => (
                            <div key={d} className="text-center text-[10px] font-medium text-zinc-600 uppercase">
                                {t(d)}
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
                            const badges = dayBadges[dateKey] || []
                            const isToday = dateKey === format(new Date(), 'yyyy-MM-dd')
                            const isFuture = isAfter(day, new Date())
                            const isTappable = !!status || !!special || badges.length > 0

                            // Base styling based on answer status
                            const statusClass = status === 'both'
                                ? 'bg-rose-500/20 text-rose-400'
                                : status === 'partial'
                                    ? 'bg-zinc-700/30 text-zinc-400'
                                    : isFuture && isTappable
                                        ? 'bg-amber-500/10 text-amber-300' // Future dates with content get highlighted
                                        : isFuture
                                            ? 'text-zinc-800'
                                            : 'text-zinc-600'

                            // Special date ring overlay (doesn't replace answer status)
                            const specialRing = special ? 'ring-1 ring-amber-500/50' : (isFuture && isTappable ? 'ring-1 ring-amber-500/50' : '')
                            const hoverClass = isTappable ? 'hover:brightness-125 cursor-pointer' : ''
                            const todayRing = isToday ? 'ring-1 ring-rose-500/50' : ''

                            const BADGE_COLORS: Record<string, string> = {
                                event: 'bg-blue-400', task: 'bg-emerald-400', memory: 'bg-amber-400',
                                milestone: 'bg-purple-400', dateplan: 'bg-pink-400', journal: 'bg-cyan-400',
                            }

                            return (
                                <button
                                    key={dateKey}
                                    onClick={() => {
                                        if (special) {
                                            setSelectedSpecial(special)
                                            if (status || badges.length > 0) {
                                                setTimeout(() => router.push(`/app/inbox/${dateKey}`), 1200)
                                            }
                                        } else if (isTappable) {
                                            router.push(`/app/inbox/${dateKey}`)
                                        }
                                    }}
                                    disabled={!isTappable || (isFuture && !special && badges.length === 0)}
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
                                    {/* Content badges */}
                                    {badges.length > 0 && !special && (
                                        <div className="flex gap-px absolute bottom-0.5 left-1/2 -translate-x-1/2">
                                            {badges.slice(0, 3).map(b => (
                                                <span key={b} className={`w-1 h-1 rounded-full ${BADGE_COLORS[b] || 'bg-zinc-500'}`} />
                                            ))}
                                            {badges.length > 3 && <span className="text-[5px] text-zinc-500 leading-none">+</span>}
                                        </div>
                                    )}
                                    {journalCounts[dateKey] > 1 && !special && (
                                        <span className="absolute bottom-0.5 right-0.5 text-[8px] text-cyan-300">
                                            {journalCounts[dateKey]}
                                        </span>
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
                    <div className="flex items-center justify-end flex-wrap gap-x-3 gap-y-1.5 mt-4 text-[10px] text-zinc-500">
                        <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-rose-500/40 mr-1" /> {t('legendBoth')}</div>
                        <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-zinc-700/50 mr-1" /> {t('legendPartial')}</div>
                        <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-amber-500/30 ring-1 ring-amber-500/30 mr-1" /> {t('legendSpecial')}</div>
                        <div className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1" /> {t('legendEvent')}</div>
                        <div className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" /> {t('legendTask')}</div>
                        <div className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1" /> {t('legendMemory')}</div>
                        <div className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1" /> {t('legendMilestone')}</div>
                        <div className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-pink-400 mr-1" /> {t('legendDatePlan')}</div>
                        <div className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1" /> {t('legendJournal')}</div>
                    </div>
                </div>
            </div>

            {/* Activity Heatmap - newest first */}
            <div className="space-y-4 pt-4">
                <h3 className="font-semibold text-lg">{t('last90Days')}</h3>
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
                            {t('activityEmpty')}
                        </p>
                    )}
                    <div className="flex items-center justify-between mt-6 text-xs text-zinc-500">
                        <span>{t('newest')}</span>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-zinc-800 mr-2" /> {t('missed')}</div>
                            <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-zinc-600 mr-2" /> {t('partial')}</div>
                            <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-rose-500 mr-2" /> {t('completed')}</div>
                        </div>
                        <span>{t('oldest')}</span>
                    </div>
                </div>
            </div>

            {/* Recap Links */}
            <div className="space-y-4 pt-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-purple-500" /> {t('recap')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <Link
                        href={`/app/recap/${currentYear}/${currentMonth}`}
                        className="bg-gradient-to-br from-purple-500/10 to-zinc-900 border border-purple-500/20 rounded-2xl p-4 text-center hover:border-purple-500/40 transition-colors"
                    >
                        <p className="text-sm font-medium text-purple-400">{t('thisMonth')}</p>
                        <p className="text-xs text-zinc-500 mt-1">{format(new Date(), 'MMMM', { locale: dateLoc })}</p>
                    </Link>
                    <Link
                        href={`/app/recap/${currentYear}`}
                        className="bg-gradient-to-br from-rose-500/10 to-zinc-900 border border-rose-500/20 rounded-2xl p-4 text-center hover:border-rose-500/40 transition-colors"
                    >
                        <p className="text-sm font-medium text-rose-400">{t('thisYear')}</p>
                        <p className="text-xs text-zinc-500 mt-1">{currentYear}</p>
                    </Link>
                </div>
            </div>

            {/* Milestones */}
            <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" /> {t('milestones')}
                    </h3>
                    <button
                        onClick={() => {
                            setEditingMilestone(null)
                            setMsKind('custom')
                            setMsTitle('')
                            setMsDate(format(new Date(), 'yyyy-MM-dd'))
                            setMsNote('')
                            setShowMilestoneForm(true)
                        }}
                        className="flex items-center gap-1 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> {t('add')}
                    </button>
                </div>

                {userMilestones.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                        <Trophy className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
                        {t('noMilestones')}
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
                                    <p className="text-xs text-zinc-500">{format(parseISO(ms.happened_at), 'MMM d, yyyy', { locale: dateLoc })}</p>
                                    {ms.note && <p className="text-xs text-zinc-400 mt-1">{ms.note}</p>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                        onClick={() => openEditMilestone(ms)}
                                        className="p-1.5 rounded-lg hover:bg-zinc-800"
                                        aria-label={t('editMilestoneAria')}
                                    >
                                        <Pencil className="w-3.5 h-3.5 text-zinc-500" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteMilestone(ms.id)}
                                        className="p-1.5 rounded-lg hover:bg-zinc-800"
                                        aria-label={t('deleteMilestoneAria')}
                                    >
                                        <X className="w-3.5 h-3.5 text-zinc-500" />
                                    </button>
                                </div>
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
                    <p className="text-sm font-medium">{t('memories')}</p>
                    <p className="text-xs text-zinc-500">{t('memoriesDesc')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0" />
            </Link>

            {/* ═══ MILESTONE FORM MODAL ═══ */}
            {showMilestoneForm && (
                <div
                    className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => { setShowMilestoneForm(false); setEditingMilestone(null) }}
                >
                    <div
                        className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{editingMilestone ? t('editMilestone') : t('newMilestone')}</h3>
                            <button onClick={() => { setShowMilestoneForm(false); setEditingMilestone(null) }} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors" aria-label={t('close')}>
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
                                            if (k.value !== 'custom') setMsTitle(t(k.labelKey).replace(/^\S+\s/, ''))
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                            msKind === k.value ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400'
                                        }`}
                                    >
                                        {t(k.labelKey)}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                placeholder={t('titlePlaceholder')}
                                value={msTitle}
                                onChange={e => setMsTitle(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-zinc-600"
                                maxLength={120}
                            />
                            <div>
                                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">{t('whenLabel')}</label>
                                <input
                                    type="date"
                                    value={msDate}
                                    onChange={e => setMsDate(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 [color-scheme:dark]"
                                />
                            </div>
                            <textarea
                                placeholder={t('notePlaceholder')}
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
                            {isSavingMs ? t('saving') : t('addMilestone')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
