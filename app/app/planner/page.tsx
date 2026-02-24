'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useToast } from '@/components/ui/toast'
import { useTranslations, useLocale } from '@/lib/i18n'
import { getDateLocale } from '@/lib/i18n/date-locale'
import { Button } from '@/components/ui/button'
import {
    CalendarDays, Plus, Check, Circle, Trash2, MapPin, Clock, Bell,
    X, ChevronDown, ChevronUp, Pencil, User, Heart, Lightbulb,
    Shuffle, Sparkles, Filter, DollarSign, Timer, Sun, CheckCircle2, Share2
} from 'lucide-react'
import { format, parseISO, isPast, isToday as isTodayFn, isTomorrow, addDays, nextSaturday, nextSunday, isSaturday, isSunday, type Locale } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

const TIMEZONE = 'Europe/Oslo'

function getDateKey(date?: Date) {
    const d = date || new Date()
    const osloHour = parseInt(formatInTimeZone(d, TIMEZONE, 'HH'), 10)
    const businessDate = osloHour < 6 ? new Date(d.getTime() - 24 * 60 * 60 * 1000) : d
    return formatInTimeZone(businessDate, TIMEZONE, 'yyyy-MM-dd')
}

function formatEventDate(startAt: string, allDay: boolean, dateLoc?: Locale): string {
    const d = parseISO(startAt)
    if (allDay) return format(d, 'EEE, MMM d', { locale: dateLoc })
    return format(d, 'EEE, MMM d · HH:mm', { locale: dateLoc })
}

function formatDateLabel(dateKey: string, todayLabel = 'Today', tomorrowLabel = 'Tomorrow', dateLoc?: Locale): string {
    const d = parseISO(dateKey)
    if (isTodayFn(d)) return todayLabel
    if (isTomorrow(d)) return tomorrowLabel
    return format(d, 'EEEE, MMM d', { locale: dateLoc })
}

type SharedEvent = {
    id: string
    room_id: string
    created_by: string
    title: string
    description: string | null
    location: string | null
    start_at: string
    end_at: string | null
    all_day: boolean
    date_key: string
    reminder_at: string | null
    created_at: string
}

type SharedTask = {
    id: string
    room_id: string
    created_by: string
    title: string
    notes: string | null
    due_at: string | null
    due_date_key: string | null
    is_done: boolean
    completed_at: string | null
    reminder_at: string | null
    created_at: string
}

type DateIdea = {
    id: string
    room_id: string | null
    created_by: string | null
    title: string
    description: string | null
    category: string
    price_level: string
    duration_minutes: number
    time_of_day: string
    is_active: boolean
    visibility?: 'room' | 'public'
    language?: string
    published_at?: string | null
    like_count?: number
    created_at?: string
}

type DateCompletion = {
    id: string
    room_id: string
    date_idea_id: string
    created_by: string
    status: string
    planned_for: string | null
    completed_at: string | null
    created_at: string
    date_ideas?: DateIdea
}

const CATEGORIES = [
    { key: 'food', label: '🍽️ Food', emoji: '🍽️' },
    { key: 'outdoors', label: '🌿 Outdoors', emoji: '🌿' },
    { key: 'culture', label: '🎭 Culture', emoji: '🎭' },
    { key: 'cozy', label: '🕯️ Cozy', emoji: '🕯️' },
    { key: 'travel', label: '✈️ Travel', emoji: '✈️' },
    { key: 'home', label: '🏠 Home', emoji: '🏠' },
    { key: 'surprise', label: '🎁 Surprise', emoji: '🎁' },
    { key: 'other', label: '✨ Other', emoji: '✨' },
]

const PRICE_LABELS: Record<string, string> = { free: 'Free', low: '$', medium: '$$', high: '$$$' }
const PRICE_COLORS: Record<string, string> = { free: 'text-emerald-400', low: 'text-zinc-400', medium: 'text-amber-400', high: 'text-rose-400' }

const LANGUAGES: { code: string; label: string }[] = [
    { code: 'nb', label: 'Norsk' },
    { code: 'nn', label: 'Nynorsk' },
    { code: 'en', label: 'English' },
    { code: 'sv', label: 'Svenska' },
    { code: 'da', label: 'Dansk' },
]
const LANG_LABEL: Record<string, string> = Object.fromEntries(LANGUAGES.map(l => [l.code, l.label]))

function formatDuration(mins: number): string {
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h}h ${m}m` : `${h}h`
}

type Tab = 'events' | 'tasks' | 'ideas'

export default function PlannerPage() {
    const [tab, setTab] = useState<Tab>('events')
    const [events, setEvents] = useState<SharedEvent[]>([])
    const [tasks, setTasks] = useState<SharedTask[]>([])
    const [roomId, setRoomId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Event form
    const [showEventForm, setShowEventForm] = useState(false)
    const [editingEvent, setEditingEvent] = useState<SharedEvent | null>(null)
    const [eventTitle, setEventTitle] = useState('')
    const [eventDesc, setEventDesc] = useState('')
    const [eventLocation, setEventLocation] = useState('')
    const [eventStartAt, setEventStartAt] = useState('')
    const [eventEndAt, setEventEndAt] = useState('')
    const [eventAllDay, setEventAllDay] = useState(false)
    const [eventReminder, setEventReminder] = useState(false)
    const [isSavingEvent, setIsSavingEvent] = useState(false)

    // Task form
    const [newTaskTitle, setNewTaskTitle] = useState('')
    const [isAddingTask, setIsAddingTask] = useState(false)
    const [showDoneTasks, setShowDoneTasks] = useState(false)

    // Ideas state
    const [roomIdeas, setRoomIdeas] = useState<DateIdea[]>([])
    const [publicIdeas, setPublicIdeas] = useState<DateIdea[]>([])
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
    const [completions, setCompletions] = useState<DateCompletion[]>([])
    const [catFilter, setCatFilter] = useState<string | null>(null)
    const [priceFilter, setPriceFilter] = useState<string | null>(null)
    const [showSavedOnly, setShowSavedOnly] = useState(false)
    const [randomIdea, setRandomIdea] = useState<DateIdea | null>(null)
    const [showAddIdea, setShowAddIdea] = useState(false)
    const [newIdeaTitle, setNewIdeaTitle] = useState('')
    const [newIdeaDesc, setNewIdeaDesc] = useState('')
    const [newIdeaCat, setNewIdeaCat] = useState('food')
    const [newIdeaPrice, setNewIdeaPrice] = useState('free')
    const [newIdeaDuration, setNewIdeaDuration] = useState('90')
    const [newIdeaTime, setNewIdeaTime] = useState('any')
    const [isSavingIdea, setIsSavingIdea] = useState(false)
    const [ideasTab, setIdeasTab] = useState<'room' | 'public'>('room')
    const [publicSort, setPublicSort] = useState<'trending' | 'newest'>('trending')
    const [publicLang, setPublicLang] = useState('nb')
    const [showPublishIdea, setShowPublishIdea] = useState(false)
    const [publishIdea, setPublishIdea] = useState<DateIdea | null>(null)
    const [publishLang, setPublishLang] = useState('nb')
    const [isPublishing, setIsPublishing] = useState(false)

    const supabase = createClient()
    const { user } = useAuth()
    const { toast } = useToast()
    const t = useTranslations('planner')
    const { locale } = useLocale()
    const dateLoc = getDateLocale(locale)

    // ─── Load Data ───
    const loadData = useCallback(async () => {
        if (!user) return
        try {
            setIsLoading(true)
            const { data: member } = await supabase
                .from('room_members')
                .select('room_id')
                .eq('user_id', user.id)
                .single()
            if (!member) return
            setRoomId(member.room_id)

            const [eventsRes, tasksRes, publicIdeasRes, roomIdeasRes, savedRes, completionsRes, likesRes] = await Promise.all([
                supabase
                    .from('shared_events')
                    .select('*')
                    .eq('room_id', member.room_id)
                    .gte('date_key', getDateKey())
                    .order('start_at', { ascending: true })
                    .limit(100),
                supabase
                    .from('shared_tasks')
                    .select('*')
                    .eq('room_id', member.room_id)
                    .order('created_at', { ascending: false })
                    .limit(200),
                supabase
                    .from('date_ideas')
                    .select('*')
                    .eq('visibility', 'public')
                    .eq('is_active', true)
                    .order('like_count', { ascending: false }),
                supabase
                    .from('date_ideas')
                    .select('*')
                    .eq('room_id', member.room_id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('saved_date_ideas')
                    .select('date_idea_id')
                    .eq('room_id', member.room_id)
                    .eq('user_id', user.id),
                supabase
                    .from('date_completions')
                    .select('*, date_ideas(*)')
                    .eq('room_id', member.room_id)
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase
                    .from('date_idea_likes')
                    .select('date_idea_id')
                    .eq('user_id', user.id),
            ])

            setEvents(eventsRes.data || [])
            setTasks(tasksRes.data || [])
            setPublicIdeas(publicIdeasRes.data || [])
            setRoomIdeas(roomIdeasRes.data || [])
            setSavedIds(new Set((savedRes.data || []).map((s: any) => s.date_idea_id)))
            setCompletions(completionsRes.data || [])
            setLikedIds(new Set((likesRes.data || []).map((l: any) => l.date_idea_id)))
        } catch (err) {
            console.error('Error loading planner', err)
        } finally {
            setIsLoading(false)
        }
    }, [user, supabase])

    useEffect(() => { loadData() }, [loadData])

    useEffect(() => {
        if (ideasTab === 'public' && showSavedOnly) {
            setShowSavedOnly(false)
        }
    }, [ideasTab, showSavedOnly])

    // ─── Realtime ───
    useEffect(() => {
        if (!roomId) return
        const channel = supabase
            .channel(`planner-${roomId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shared_events',
                filter: `room_id=eq.${roomId}`,
            }, () => { loadData() })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shared_tasks',
                filter: `room_id=eq.${roomId}`,
            }, () => { loadData() })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'date_completions',
                filter: `room_id=eq.${roomId}`,
            }, () => { loadData() })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [roomId, supabase, loadData])

    // ─── Event Helpers ───
    function resetEventForm() {
        setEventTitle('')
        setEventDesc('')
        setEventLocation('')
        setEventStartAt('')
        setEventEndAt('')
        setEventAllDay(false)
        setEventReminder(false)
        setEditingEvent(null)
        setShowEventForm(false)
    }

    function openEditEvent(ev: SharedEvent) {
        setEditingEvent(ev)
        setEventTitle(ev.title)
        setEventDesc(ev.description || '')
        setEventLocation(ev.location || '')
        setEventAllDay(ev.all_day)
        // Convert to datetime-local format
        if (ev.all_day) {
            setEventStartAt(ev.date_key)
        } else {
            setEventStartAt(formatInTimeZone(parseISO(ev.start_at), TIMEZONE, "yyyy-MM-dd'T'HH:mm"))
        }
        setEventEndAt(ev.end_at ? formatInTimeZone(parseISO(ev.end_at), TIMEZONE, "yyyy-MM-dd'T'HH:mm") : '')
        setEventReminder(!!ev.reminder_at)
        setShowEventForm(true)
    }

    async function handleSaveEvent() {
        if (!roomId || !user || !eventTitle.trim() || !eventStartAt) return
        setIsSavingEvent(true)
        try {
            let startAt: string
            let dateKey: string

            if (eventAllDay) {
                // For all-day, set start_at to midnight Oslo
                startAt = `${eventStartAt}T00:00:00+01:00`
                dateKey = eventStartAt
            } else {
                startAt = new Date(eventStartAt).toISOString()
                dateKey = getDateKey(new Date(eventStartAt))
            }

            const reminderAt = eventReminder
                ? new Date(new Date(startAt).getTime() - 30 * 60 * 1000).toISOString()
                : null

            const payload = {
                room_id: roomId,
                created_by: user.id,
                title: eventTitle.trim(),
                description: eventDesc.trim() || null,
                location: eventLocation.trim() || null,
                start_at: startAt,
                end_at: eventEndAt ? new Date(eventEndAt).toISOString() : null,
                all_day: eventAllDay,
                date_key: dateKey,
                reminder_at: reminderAt,
            }

            if (editingEvent) {
                const { created_by, room_id, ...updatePayload } = payload
                const { error } = await supabase
                    .from('shared_events')
                    .update(updatePayload)
                    .eq('id', editingEvent.id)
                if (error) throw error
                toast(t('toastEventUpdated'), 'success')
            } else {
                const { error } = await supabase
                    .from('shared_events')
                    .insert(payload)
                if (error) throw error
                toast(t('toastEventCreated'), 'success')
            }
            resetEventForm()
            loadData()
        } catch (err: any) {
            toast(err.message || t('toastFailedSaveEvent'), 'error')
        } finally {
            setIsSavingEvent(false)
        }
    }

    async function handleDeleteEvent(id: string) {
        const { error } = await supabase.from('shared_events').delete().eq('id', id)
        if (error) { toast(t('toastFailedDelete'), 'error'); return }
        toast(t('toastEventDeleted'), 'success')
        loadData()
    }

    // ─── Task Helpers ───
    async function handleAddTask() {
        if (!roomId || !user || !newTaskTitle.trim()) return
        setIsAddingTask(true)
        try {
            const { error } = await supabase.from('shared_tasks').insert({
                room_id: roomId,
                created_by: user.id,
                title: newTaskTitle.trim(),
            })
            if (error) throw error
            setNewTaskTitle('')
            loadData()
        } catch (err: any) {
            toast(err.message || t('toastFailedAddTask'), 'error')
        } finally {
            setIsAddingTask(false)
        }
    }

    async function handleToggleTask(task: SharedTask) {
        const newDone = !task.is_done
        const { error } = await supabase
            .from('shared_tasks')
            .update({
                is_done: newDone,
                completed_at: newDone ? new Date().toISOString() : null,
            })
            .eq('id', task.id)
        if (error) { toast(t('toastFailedUpdate'), 'error'); return }
        loadData()
    }

    async function handleDeleteTask(id: string) {
        const { error } = await supabase.from('shared_tasks').delete().eq('id', id)
        if (error) { toast(t('toastFailedDelete'), 'error'); return }
        loadData()
    }

    // ─── Ideas Helpers ───
    async function handleToggleSaveIdea(ideaId: string) {
        if (!roomId || !user) return
        if (savedIds.has(ideaId)) {
            await supabase.from('saved_date_ideas').delete().eq('date_idea_id', ideaId).eq('user_id', user.id)
            setSavedIds(prev => { const n = new Set(prev); n.delete(ideaId); return n })
        } else {
            await supabase.from('saved_date_ideas').insert({ date_idea_id: ideaId, user_id: user.id, room_id: roomId })
            setSavedIds(prev => new Set(prev).add(ideaId))
        }
    }

    async function handleToggleLike(idea: DateIdea) {
        if (!user) return
        if (likedIds.has(idea.id)) {
            await supabase
                .from('date_idea_likes')
                .delete()
                .eq('date_idea_id', idea.id)
                .eq('user_id', user.id)
            setLikedIds(prev => { const n = new Set(prev); n.delete(idea.id); return n })
        } else {
            await supabase
                .from('date_idea_likes')
                .insert({ date_idea_id: idea.id, user_id: user.id })
            setLikedIds(prev => new Set(prev).add(idea.id))
        }
        loadData()
    }

    function openPublishIdea(idea: DateIdea) {
        setPublishIdea(idea)
        setPublishLang('nb')
        setShowPublishIdea(true)
    }

    async function handlePublishIdea() {
        if (!user || !publishIdea) return
        setIsPublishing(true)
        try {
            const { error } = await supabase.from('date_ideas').insert({
                room_id: null,
                created_by: user.id,
                title: publishIdea.title,
                description: publishIdea.description,
                category: publishIdea.category,
                price_level: publishIdea.price_level,
                duration_minutes: publishIdea.duration_minutes,
                time_of_day: publishIdea.time_of_day,
                visibility: 'public',
                language: publishLang,
                published_at: new Date().toISOString(),
                is_active: true,
            })
            if (error) throw error
            toast(t('toastPublished'), 'success')
            setShowPublishIdea(false)
            setPublishIdea(null)
            loadData()
        } catch (err: any) {
            toast(err.message || t('toastFailedPublish'), 'error')
        } finally {
            setIsPublishing(false)
        }
    }

    async function handlePlanIdea(idea: DateIdea) {
        if (!roomId || !user) return
        const now = new Date()
        // Next Saturday in Oslo
        let sat: Date
        if (isSaturday(now)) {
            sat = now
        } else if (isSunday(now)) {
            sat = nextSaturday(now)
        } else {
            sat = nextSaturday(now)
        }
        const plannedFor = formatInTimeZone(sat, TIMEZONE, 'yyyy-MM-dd')
        const startAt = `${plannedFor}T18:00:00+01:00`
        const dateKey = plannedFor

        try {
            // Create shared event
            const { data: evData, error: evErr } = await supabase
                .from('shared_events')
                .insert({
                    room_id: roomId,
                    created_by: user.id,
                    title: `Date: ${idea.title}`,
                    description: idea.description || null,
                    start_at: startAt,
                    all_day: false,
                    date_key: dateKey,
                })
                .select('id')
                .single()
            if (evErr) throw evErr

            // Create completion
            const { error: cErr } = await supabase.from('date_completions').insert({
                room_id: roomId,
                date_idea_id: idea.id,
                created_by: user.id,
                status: 'planned',
                planned_for: plannedFor,
                planned_event_id: evData?.id || null,
            })
            if (cErr) throw cErr

            toast(t('toastPlannedWeekend'), 'success')
            loadData()
        } catch (err: any) {
            toast(err.message || t('toastFailedPlan'), 'error')
        }
    }

    async function handleMarkDone(completion: DateCompletion) {
        const { error } = await supabase
            .from('date_completions')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('id', completion.id)
        if (error) { toast(t('toastFailedUpdate'), 'error'); return }
        toast(t('toastMarkedDone'), 'success')
        loadData()
    }

    async function handleSkipCompletion(completion: DateCompletion) {
        const { error } = await supabase
            .from('date_completions')
            .update({ status: 'skipped' })
            .eq('id', completion.id)
        if (error) { toast(t('toastFailedUpdate'), 'error'); return }
        loadData()
    }

    async function handleDeleteCompletion(id: string) {
        const { error } = await supabase.from('date_completions').delete().eq('id', id)
        if (error) { toast(t('toastFailedDelete'), 'error'); return }
        loadData()
    }

    function handleRandomSuggestion() {
        const pool = filteredIdeas.length > 0
            ? filteredIdeas
            : (ideasTab === 'public' ? sortedPublicIdeas : roomIdeas)
        if (pool.length === 0) return
        const pick = pool[Math.floor(Math.random() * pool.length)]
        setRandomIdea(pick)
    }

    async function handleAddCustomIdea() {
        if (!roomId || !user || !newIdeaTitle.trim()) return
        setIsSavingIdea(true)
        try {
            const { error } = await supabase.from('date_ideas').insert({
                room_id: roomId,
                created_by: user.id,
                title: newIdeaTitle.trim(),
                description: newIdeaDesc.trim() || null,
                category: newIdeaCat,
                price_level: newIdeaPrice,
                duration_minutes: parseInt(newIdeaDuration) || 90,
                time_of_day: newIdeaTime,
            })
            if (error) throw error
            toast(t('toastIdeaAdded'), 'success')
            setShowAddIdea(false)
            setNewIdeaTitle(''); setNewIdeaDesc(''); setNewIdeaCat('food'); setNewIdeaPrice('free'); setNewIdeaDuration('90'); setNewIdeaTime('any')
            loadData()
        } catch (err: any) {
            toast(err.message || t('toastFailedAddIdea'), 'error')
        } finally {
            setIsSavingIdea(false)
        }
    }

    async function handleDeleteIdea(id: string) {
        const { error } = await supabase.from('date_ideas').delete().eq('id', id)
        if (error) { toast(t('toastFailedDelete'), 'error'); return }
        toast(t('toastIdeaDeleted'), 'success')
        loadData()
    }

    // ─── Derived data ───
    const openTasks = tasks.filter(tk => !tk.is_done)
    const doneTasks = tasks.filter(tk => tk.is_done)

    const baseIdeas = ideasTab === 'public'
        ? publicIdeas.filter((i) => !publicLang || i.language === publicLang)
        : roomIdeas

    const sortedPublicIdeas = ideasTab === 'public'
        ? [...baseIdeas].sort((a, b) => {
            if (publicSort === 'newest') {
                return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            }
            return (b.like_count || 0) - (a.like_count || 0)
        })
        : baseIdeas

    // Filtered ideas
    const filteredIdeas = sortedPublicIdeas.filter(idea => {
        if (catFilter && idea.category !== catFilter) return false
        if (priceFilter && idea.price_level !== priceFilter) return false
        if (showSavedOnly && ideasTab === 'room' && !savedIds.has(idea.id)) return false
        return true
    })

    const plannedCompletions = completions.filter(c => c.status === 'planned')
    const doneCompletions = completions.filter(c => c.status === 'done')

    // Group events by date_key
    const eventGroups: { dateKey: string; items: SharedEvent[] }[] = []
    for (const ev of events) {
        const last = eventGroups[eventGroups.length - 1]
        if (last && last.dateKey === ev.date_key) {
            last.items.push(ev)
        } else {
            eventGroups.push({ dateKey: ev.date_key, items: [ev] })
        }
    }

    // ─── Render ───
    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    return (
        <div className="p-4 space-y-6 pt-8 md:pt-12 pb-24 animate-in fade-in">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
                <p className="text-sm text-zinc-400">{t('subtitle')}</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-900 rounded-xl p-1">
                <button
                    onClick={() => setTab('events')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tab === 'events'
                            ? 'bg-zinc-800 text-white'
                            : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    aria-current={tab === 'events' ? 'page' : undefined}
                >
                    <CalendarDays className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                    {t('tabEvents')}
                </button>
                <button
                    onClick={() => setTab('tasks')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tab === 'tasks'
                            ? 'bg-zinc-800 text-white'
                            : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    aria-current={tab === 'tasks' ? 'page' : undefined}
                >
                    <Check className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                    {t('tabTasks')} ({openTasks.length})
                </button>
                <button
                    onClick={() => setTab('ideas')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                        tab === 'ideas'
                            ? 'bg-zinc-800 text-white'
                            : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    aria-current={tab === 'ideas' ? 'page' : undefined}
                >
                    <Lightbulb className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                    {t('tabIdeas')}
                </button>
            </div>

            {/* ═══ EVENTS TAB ═══ */}
            {tab === 'events' && (
                <div className="space-y-4">
                    <Button
                        onClick={() => { resetEventForm(); setShowEventForm(true) }}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" /> {t('addEvent')}
                    </Button>

                    {eventGroups.length === 0 ? (
                        <div className="text-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                            <CalendarDays className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
                            {t('noUpcomingPlans')}
                        </div>
                    ) : (
                        eventGroups.map(({ dateKey, items }) => (
                            <div key={dateKey} className="space-y-2">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 sticky top-0 bg-zinc-950/90 backdrop-blur-sm py-1 z-10">
                                    {formatDateLabel(dateKey, t('today'), t('tomorrow'), dateLoc)}
                                </h3>
                                {items.map(ev => (
                                    <div
                                        key={ev.id}
                                        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2 group"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <p className="font-medium text-sm leading-snug">{ev.title}</p>
                                                <p className="text-xs text-zinc-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatEventDate(ev.start_at, ev.all_day, dateLoc)}
                                                    {ev.end_at && <> — {format(parseISO(ev.end_at), 'HH:mm')}</>}
                                                </p>
                                                {ev.location && (
                                                    <p className="text-xs text-zinc-500 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" /> {ev.location}
                                                    </p>
                                                )}
                                                {ev.description && (
                                                    <p className="text-xs text-zinc-400 mt-1">{ev.description}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                {ev.reminder_at && (
                                                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                                                )}
                                                <button
                                                    onClick={() => openEditEvent(ev)}
                                                    className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                                                    aria-label="Edit event"
                                                >
                                                    <Pencil className="w-3.5 h-3.5 text-zinc-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteEvent(ev.id)}
                                                    className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                                                    aria-label="Delete event"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ═══ TASKS TAB ═══ */}
            {tab === 'tasks' && (
                <div className="space-y-4">
                    {/* Quick add */}
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleAddTask() }}
                        className="flex gap-2"
                    >
                        <input
                            type="text"
                            placeholder={t('addTaskPlaceholder')}
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
                            maxLength={140}
                            disabled={isAddingTask}
                        />
                        <Button
                            type="submit"
                            disabled={!newTaskTitle.trim() || isAddingTask}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-4 shrink-0"
                            aria-label="Add task"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </form>

                    {/* Open tasks */}
                    {openTasks.length === 0 && doneTasks.length === 0 ? (
                        <div className="text-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                            <Check className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
                            {t('noTasks')}
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {openTasks.map(task => (
                                <div
                                    key={task.id}
                                    className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 group"
                                >
                                    <button
                                        onClick={() => handleToggleTask(task)}
                                        className="shrink-0 text-zinc-600 hover:text-rose-400 transition-colors"
                                        aria-label={`Mark "${task.title}" as done`}
                                    >
                                        <Circle className="w-5 h-5" />
                                    </button>
                                    <span className="flex-1 text-sm min-w-0 truncate">{task.title}</span>
                                    {task.due_at && (
                                        <span className={`text-[10px] shrink-0 ${
                                            isPast(parseISO(task.due_at)) ? 'text-red-400' : 'text-zinc-500'
                                        }`}>
                                            {format(parseISO(task.due_at), 'MMM d', { locale: dateLoc })}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => handleDeleteTask(task.id)}
                                        className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-800 transition-all shrink-0"
                                        aria-label={`Delete "${task.title}"`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Done tasks */}
                    {doneTasks.length > 0 && (
                        <div>
                            <button
                                onClick={() => setShowDoneTasks(!showDoneTasks)}
                                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors w-full py-2"
                            >
                                {showDoneTasks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {t('completed')} ({doneTasks.length})
                            </button>
                            {showDoneTasks && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {doneTasks.map(task => (
                                        <div
                                            key={task.id}
                                            className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/50 rounded-xl px-4 py-3 group"
                                        >
                                            <button
                                                onClick={() => handleToggleTask(task)}
                                                className="shrink-0 text-emerald-500 hover:text-zinc-400 transition-colors"
                                                aria-label={`Mark "${task.title}" as not done`}
                                            >
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <span className="flex-1 text-sm min-w-0 truncate text-zinc-500 line-through">{task.title}</span>
                                            <button
                                                onClick={() => handleDeleteTask(task.id)}
                                                className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-800 transition-all shrink-0"
                                                aria-label={`Delete "${task.title}"`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ IDEAS TAB ═══ */}
            {tab === 'ideas' && (
                <div className="space-y-4">
                    {/* Room/Public toggle */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIdeasTab('room')}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                ideasTab === 'room' ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}
                        >
                            {t('forUs')}
                        </button>
                        <button
                            onClick={() => setIdeasTab('public')}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                ideasTab === 'public' ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}
                        >
                            {t('public')}
                        </button>

                        {ideasTab === 'public' && (
                            <div className="ml-auto flex items-center gap-2">
                                <select
                                    value={publicLang}
                                    onChange={(e) => setPublicLang(e.target.value)}
                                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300 appearance-none bg-[length:12px] bg-[right_6px_center] bg-no-repeat bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M3%204.5l3%203%203-3%22/%3E%3C/svg%3E')] pr-5 [color-scheme:dark]"
                                >
                                    {LANGUAGES.map(l => (
                                        <option key={l.code} value={l.code}>{l.label}</option>
                                    ))}
                                </select>
                                <select
                                    value={publicSort}
                                    onChange={(e) => setPublicSort(e.target.value as 'trending' | 'newest')}
                                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-300 [color-scheme:dark]"
                                >
                                    <option value="trending">{t('trending')}</option>
                                    <option value="newest">{t('newest')}</option>
                                </select>
                            </div>
                        )}
                    </div>
                    {/* Planned dates section */}
                    {plannedCompletions.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('plannedDates')}</h3>
                            {plannedCompletions.map(c => (
                                <div key={c.id} className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <p className="text-sm font-medium">{c.date_ideas?.title || t('dateIdea')}</p>
                                            {c.planned_for && (
                                                <p className="text-xs text-amber-400 flex items-center gap-1">
                                                    <CalendarDays className="w-3 h-3" />
                                                    {format(parseISO(c.planned_for), 'EEE, MMM d', { locale: dateLoc })}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => handleMarkDone(c)}
                                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                                                aria-label="Mark as done"
                                            >
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            </button>
                                            <button
                                                onClick={() => handleSkipCompletion(c)}
                                                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                                                aria-label="Skip this date"
                                            >
                                                <X className="w-4 h-4 text-zinc-500" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Random suggestion card */}
                    {randomIdea && (
                        <div className="bg-gradient-to-br from-rose-500/10 via-purple-500/5 to-zinc-900 border border-rose-500/20 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-rose-400" />
                                <span className="text-xs font-medium text-rose-400 uppercase tracking-wider">{t('suggestion')}</span>
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium">{randomIdea.title}</p>
                                {randomIdea.description && (
                                    <p className="text-sm text-zinc-400">{randomIdea.description}</p>
                                )}
                                <div className="flex items-center gap-3 text-xs text-zinc-500 pt-1">
                                    <span>{CATEGORIES.find(c => c.key === randomIdea.category)?.emoji} {t('cat_' + randomIdea.category)}</span>
                                    <span className={PRICE_COLORS[randomIdea.price_level]}>{PRICE_LABELS[randomIdea.price_level]}</span>
                                    <span>{formatDuration(randomIdea.duration_minutes)}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => handlePlanIdea(randomIdea)}
                                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-sm"
                                >
                                    <CalendarDays className="w-4 h-4 mr-1.5" /> {t('planThisWeekend')}
                                </Button>
                                <button
                                    onClick={() => setRandomIdea(null)}
                                    className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                                    aria-label="Dismiss suggestion"
                                >
                                    <X className="w-4 h-4 text-zinc-500" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                        <Button
                            onClick={handleRandomSuggestion}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            <Shuffle className="w-4 h-4 mr-2" /> {t('surpriseMe')}
                        </Button>
                        {ideasTab === 'room' && (
                            <Button
                                onClick={() => setShowAddIdea(true)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4"
                                aria-label="Add custom idea"
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="space-y-2">
                        {/* Category chips */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                            <button
                                onClick={() => setCatFilter(null)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                    !catFilter ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                }`}
                            >
                                {t('all')}
                            </button>
                            {CATEGORIES.map(c => (
                                <button
                                    key={c.key}
                                    onClick={() => setCatFilter(catFilter === c.key ? null : c.key)}
                                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        catFilter === c.key ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                    }`}
                                >
                                    {c.emoji} {t('cat_' + c.key)}
                                </button>
                            ))}
                        </div>

                        {/* Secondary filters */}
                        <div className="flex gap-2">
                            <div className="flex gap-1">
                                {(['free', 'low', 'medium', 'high'] as const).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPriceFilter(priceFilter === p ? null : p)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                                            priceFilter === p ? 'bg-amber-600 text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                                        }`}
                                    >
                                        {PRICE_LABELS[p]}
                                    </button>
                                ))}
                            </div>
                            {ideasTab === 'room' && (
                                <button
                                    onClick={() => setShowSavedOnly(!showSavedOnly)}
                                    className={`ml-auto px-3 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 ${
                                        showSavedOnly ? 'bg-pink-600 text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                                    }`}
                                    aria-label={showSavedOnly ? 'Show all ideas' : 'Show saved only'}
                                >
                                    <Heart className={`w-3 h-3 ${showSavedOnly ? 'fill-current' : ''}`} /> {t('saved')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Ideas list */}
                    {filteredIdeas.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                            <Lightbulb className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
                            {showSavedOnly ? t('noSavedIdeas') : t('noIdeasMatchFilter')}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredIdeas.map(idea => (
                                <div
                                    key={idea.id}
                                    className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2 group"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{CATEGORIES.find(c => c.key === idea.category)?.emoji}</span>
                                                <p className="font-medium text-sm leading-snug">{idea.title}</p>
                                                {idea.visibility === 'public' ? (
                                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">{t('publicBadge')}</span>
                                                ) : (
                                                    <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{t('customBadge')}</span>
                                                )}
                                                {idea.visibility === 'public' && idea.language && (
                                                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{LANG_LABEL[idea.language] || idea.language}</span>
                                                )}
                                            </div>
                                            {idea.description && (
                                                <p className="text-xs text-zinc-400 line-clamp-2">{idea.description}</p>
                                            )}
                                            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                                                <span className={PRICE_COLORS[idea.price_level]}>{PRICE_LABELS[idea.price_level]}</span>
                                                <span className="flex items-center gap-0.5"><Timer className="w-3 h-3" /> {formatDuration(idea.duration_minutes)}</span>
                                                {idea.time_of_day !== 'any' && (
                                                    <span className="flex items-center gap-0.5"><Sun className="w-3 h-3" /> {idea.time_of_day}</span>
                                                )}
                                                {idea.visibility === 'public' && (
                                                    <span className="flex items-center gap-0.5 text-zinc-400">
                                                        <Heart className={`w-3 h-3 ${likedIds.has(idea.id) ? 'text-pink-500 fill-pink-500' : 'text-zinc-500'}`} />
                                                        {idea.like_count || 0}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {idea.visibility !== 'public' && (
                                                <button
                                                    onClick={() => handleToggleSaveIdea(idea.id)}
                                                    className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                                                    aria-label={savedIds.has(idea.id) ? 'Remove from saved' : 'Save idea'}
                                                >
                                                    <Heart className={`w-4 h-4 transition-colors ${
                                                        savedIds.has(idea.id) ? 'text-pink-500 fill-pink-500' : 'text-zinc-600'
                                                    }`} />
                                                </button>
                                            )}
                                            {idea.visibility === 'public' && (
                                                <button
                                                    onClick={() => handleToggleLike(idea)}
                                                    className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                                                    aria-label={likedIds.has(idea.id) ? 'Unlike idea' : 'Like idea'}
                                                >
                                                    <Heart className={`w-4 h-4 transition-colors ${
                                                        likedIds.has(idea.id) ? 'text-pink-500 fill-pink-500' : 'text-zinc-600'
                                                    }`} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handlePlanIdea(idea)}
                                                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                                                aria-label="Plan this weekend"
                                            >
                                                <CalendarDays className="w-4 h-4 text-zinc-600 hover:text-amber-400" />
                                            </button>
                                            {idea.visibility !== 'public' && (
                                                <>
                                                    <button
                                                        onClick={() => openPublishIdea(idea)}
                                                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-800 transition-all"
                                                        aria-label="Publish idea publicly"
                                                    >
                                                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteIdea(idea.id)}
                                                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-800 transition-all"
                                                        aria-label="Delete idea"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Done dates history */}
                    {doneCompletions.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 pt-2">{t('completedDates')}</h3>
                            {doneCompletions.slice(0, 5).map(c => (
                                <div key={c.id} className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/50 rounded-xl px-4 py-3">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="flex-1 text-sm text-zinc-400 truncate">{c.date_ideas?.title || t('date')}</span>
                                    {c.completed_at && (
                                        <span className="text-[10px] text-zinc-600">{format(parseISO(c.completed_at), 'MMM d', { locale: dateLoc })}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ PUBLISH IDEA MODAL ═══ */}
            {showPublishIdea && publishIdea && (
                <div
                    className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => setShowPublishIdea(false)}
                >
                    <div
                        className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{t('publishIdea')}</h3>
                            <button onClick={() => setShowPublishIdea(false)} className="p-1.5 rounded-lg hover:bg-zinc-800" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm text-zinc-300">
                                {t('publishVisibilityWarning')}
                            </p>
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                                {t('publishPrivacyNotice')}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{t('language')}</label>
                            <select
                                value={publishLang}
                                onChange={(e) => setPublishLang(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M4%206l4%204%204-4%22/%3E%3C/svg%3E')] pr-8 focus:outline-none focus:ring-1 focus:ring-rose-500/50 [color-scheme:dark]"
                            >
                                {LANGUAGES.map(l => (
                                    <option key={l.code} value={l.code}>{l.label}</option>
                                ))}
                            </select>
                        </div>

                        <Button
                            onClick={handlePublishIdea}
                            disabled={isPublishing}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isPublishing ? t('publishing') : t('publishPublicly')}
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══ ADD IDEA MODAL ═══ */}
            {showAddIdea && (
                <div
                    className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => setShowAddIdea(false)}
                >
                    <div
                        className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{t('addCustomIdea')}</h3>
                            <button onClick={() => setShowAddIdea(false)} className="p-1.5 rounded-lg hover:bg-zinc-800" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder={t('ideaTitlePlaceholder')}
                                value={newIdeaTitle}
                                onChange={e => setNewIdeaTitle(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
                                maxLength={120}
                                autoFocus
                            />

                            <textarea
                                placeholder={t('descriptionOptional')}
                                value={newIdeaDesc}
                                onChange={e => setNewIdeaDesc(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600 resize-none min-h-[60px]"
                                maxLength={800}
                            />

                            {/* Category pills */}
                            <div>
                                <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 block">{t('category')}</label>
                                <div className="flex gap-1.5 flex-wrap">
                                    {CATEGORIES.map(c => (
                                        <button
                                            key={c.key}
                                            onClick={() => setNewIdeaCat(c.key)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                                newIdeaCat === c.key ? 'bg-rose-600 text-white' : 'bg-zinc-800 text-zinc-400'
                                            }`}
                                        >
                                            {c.emoji} {t('cat_' + c.key)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Price + Duration + Time */}
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">{t('price')}</label>
                                    <select
                                        value={newIdeaPrice}
                                        onChange={e => setNewIdeaPrice(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm appearance-none bg-[length:14px] bg-[right_8px_center] bg-no-repeat bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2214%22%20height%3D%2214%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M3.5%205.25l3.5%203.5%203.5-3.5%22/%3E%3C/svg%3E')] pr-7 focus:outline-none focus:ring-1 focus:ring-rose-500/50 [color-scheme:dark]"
                                    >
                                        <option value="free">{t('priceFree')}</option>
                                        <option value="low">{t('priceLow')}</option>
                                        <option value="medium">{t('priceMedium')}</option>
                                        <option value="high">{t('priceHigh')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">{t('duration')}</label>
                                    <select
                                        value={newIdeaDuration}
                                        onChange={e => setNewIdeaDuration(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm appearance-none bg-[length:14px] bg-[right_8px_center] bg-no-repeat bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2214%22%20height%3D%2214%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M3.5%205.25l3.5%203.5%203.5-3.5%22/%3E%3C/svg%3E')] pr-7 focus:outline-none focus:ring-1 focus:ring-rose-500/50 [color-scheme:dark]"
                                    >
                                        <option value="30">{t('duration30min')}</option>
                                        <option value="60">{t('duration1hour')}</option>
                                        <option value="90">{t('duration1_5h')}</option>
                                        <option value="120">{t('duration2hours')}</option>
                                        <option value="180">{t('duration3hours')}</option>
                                        <option value="240">{t('duration4hours')}</option>
                                        <option value="480">{t('durationFullDay')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">{t('time')}</label>
                                    <select
                                        value={newIdeaTime}
                                        onChange={e => setNewIdeaTime(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm appearance-none bg-[length:14px] bg-[right_8px_center] bg-no-repeat bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2214%22%20height%3D%2214%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M3.5%205.25l3.5%203.5%203.5-3.5%22/%3E%3C/svg%3E')] pr-7 focus:outline-none focus:ring-1 focus:ring-rose-500/50 [color-scheme:dark]"
                                    >
                                        <option value="any">{t('anyTime')}</option>
                                        <option value="morning">{t('morning')}</option>
                                        <option value="afternoon">{t('afternoon')}</option>
                                        <option value="evening">{t('evening')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleAddCustomIdea}
                            disabled={!newIdeaTitle.trim() || isSavingIdea}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {isSavingIdea ? t('saving') : t('addIdeaButton')}
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══ EVENT FORM MODAL ═══ */}
            {showEventForm && (
                <div
                    className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={resetEventForm}
                >
                    <div
                        className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">
                                {editingEvent ? t('editEvent') : t('newEvent')}
                            </h3>
                            <button
                                onClick={resetEventForm}
                                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder={t('eventTitlePlaceholder')}
                                value={eventTitle}
                                onChange={e => setEventTitle(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
                                maxLength={120}
                                autoFocus
                            />

                            <textarea
                                placeholder={t('descriptionOptional')}
                                value={eventDesc}
                                onChange={e => setEventDesc(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600 resize-none min-h-[60px]"
                                maxLength={500}
                            />

                            <input
                                type="text"
                                placeholder={t('locationOptional')}
                                value={eventLocation}
                                onChange={e => setEventLocation(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
                                maxLength={120}
                            />

                            {/* All day toggle */}
                            <label className="flex items-center gap-3 px-1 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={eventAllDay}
                                    onChange={e => setEventAllDay(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-zinc-700 peer-checked:bg-rose-600 rounded-full transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
                                <span className="text-sm text-zinc-300">{t('allDay')}</span>
                            </label>

                            {/* Date/Time inputs */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">
                                        {eventAllDay ? t('dateLabel') : t('startLabel')}
                                    </label>
                                    <input
                                        type={eventAllDay ? 'date' : 'datetime-local'}
                                        value={eventStartAt}
                                        onChange={e => setEventStartAt(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 [color-scheme:dark]"
                                    />
                                </div>
                                {!eventAllDay && (
                                    <div>
                                        <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">{t('endLabel')}</label>
                                        <input
                                            type="datetime-local"
                                            value={eventEndAt}
                                            onChange={e => setEventEndAt(e.target.value)}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 [color-scheme:dark]"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Reminder toggle */}
                            <label className="flex items-center gap-3 px-1 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={eventReminder}
                                    onChange={e => setEventReminder(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-zinc-700 peer-checked:bg-amber-600 rounded-full transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-4" />
                                <span className="text-sm text-zinc-300 flex items-center gap-1.5">
                                    <Bell className="w-3.5 h-3.5" /> {t('remind30min')}
                                </span>
                            </label>
                        </div>

                        <Button
                            onClick={handleSaveEvent}
                            disabled={!eventTitle.trim() || !eventStartAt || isSavingEvent}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {isSavingEvent ? t('saving') : (editingEvent ? t('updateEvent') : t('createEvent'))}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
