'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
    CalendarDays, Plus, Check, Circle, Trash2, MapPin, Clock, Bell,
    X, ChevronDown, ChevronUp, Pencil, User
} from 'lucide-react'
import { format, parseISO, isPast, isToday as isTodayFn, isTomorrow, addDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

const TIMEZONE = 'Europe/Oslo'

function getDateKey(date?: Date) {
    const d = date || new Date()
    const osloHour = parseInt(formatInTimeZone(d, TIMEZONE, 'HH'), 10)
    const businessDate = osloHour < 6 ? new Date(d.getTime() - 24 * 60 * 60 * 1000) : d
    return formatInTimeZone(businessDate, TIMEZONE, 'yyyy-MM-dd')
}

function formatEventDate(startAt: string, allDay: boolean): string {
    const d = parseISO(startAt)
    if (allDay) return format(d, 'EEE, MMM d')
    return format(d, 'EEE, MMM d · HH:mm')
}

function formatDateLabel(dateKey: string): string {
    const d = parseISO(dateKey)
    if (isTodayFn(d)) return 'Today'
    if (isTomorrow(d)) return 'Tomorrow'
    return format(d, 'EEEE, MMM d')
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

type Tab = 'events' | 'tasks'

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

    const supabase = createClient()
    const { user } = useAuth()
    const { toast } = useToast()

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

            const [eventsRes, tasksRes] = await Promise.all([
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
            ])

            setEvents(eventsRes.data || [])
            setTasks(tasksRes.data || [])
        } catch (err) {
            console.error('Error loading planner', err)
        } finally {
            setIsLoading(false)
        }
    }, [user, supabase])

    useEffect(() => { loadData() }, [loadData])

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
                toast('Event updated', 'success')
            } else {
                const { error } = await supabase
                    .from('shared_events')
                    .insert(payload)
                if (error) throw error
                toast('Event created', 'success')
            }
            resetEventForm()
            loadData()
        } catch (err: any) {
            toast(err.message || 'Failed to save event', 'error')
        } finally {
            setIsSavingEvent(false)
        }
    }

    async function handleDeleteEvent(id: string) {
        const { error } = await supabase.from('shared_events').delete().eq('id', id)
        if (error) { toast('Failed to delete', 'error'); return }
        toast('Event deleted', 'success')
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
            toast(err.message || 'Failed to add task', 'error')
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
        if (error) { toast('Failed to update', 'error'); return }
        loadData()
    }

    async function handleDeleteTask(id: string) {
        const { error } = await supabase.from('shared_tasks').delete().eq('id', id)
        if (error) { toast('Failed to delete', 'error'); return }
        loadData()
    }

    // ─── Derived data ───
    const openTasks = tasks.filter(t => !t.is_done)
    const doneTasks = tasks.filter(t => t.is_done)

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
                <h1 className="text-2xl font-semibold tracking-tight">Planner</h1>
                <p className="text-sm text-zinc-400">Your shared plans &amp; tasks.</p>
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
                    Events
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
                    Tasks ({openTasks.length})
                </button>
            </div>

            {/* ═══ EVENTS TAB ═══ */}
            {tab === 'events' && (
                <div className="space-y-4">
                    <Button
                        onClick={() => { resetEventForm(); setShowEventForm(true) }}
                        className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Add event
                    </Button>

                    {eventGroups.length === 0 ? (
                        <div className="text-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                            <CalendarDays className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
                            No upcoming plans yet.
                        </div>
                    ) : (
                        eventGroups.map(({ dateKey, items }) => (
                            <div key={dateKey} className="space-y-2">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 sticky top-0 bg-zinc-950/90 backdrop-blur-sm py-1 z-10">
                                    {formatDateLabel(dateKey)}
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
                                                    {formatEventDate(ev.start_at, ev.all_day)}
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
                            placeholder="Add a task..."
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
                            No tasks — add your first one.
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
                                            {format(parseISO(task.due_at), 'MMM d')}
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
                                Completed ({doneTasks.length})
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
                                {editingEvent ? 'Edit event' : 'New event'}
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
                                placeholder="Event title *"
                                value={eventTitle}
                                onChange={e => setEventTitle(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
                                maxLength={120}
                                autoFocus
                            />

                            <textarea
                                placeholder="Description (optional)"
                                value={eventDesc}
                                onChange={e => setEventDesc(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600 resize-none min-h-[60px]"
                                maxLength={500}
                            />

                            <input
                                type="text"
                                placeholder="Location (optional)"
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
                                <span className="text-sm text-zinc-300">All day</span>
                            </label>

                            {/* Date/Time inputs */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">
                                        {eventAllDay ? 'Date *' : 'Start *'}
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
                                        <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">End</label>
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
                                    <Bell className="w-3.5 h-3.5" /> Remind 30 min before
                                </span>
                            </label>
                        </div>

                        <Button
                            onClick={handleSaveEvent}
                            disabled={!eventTitle.trim() || !eventStartAt || isSavingEvent}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {isSavingEvent ? 'Saving...' : (editingEvent ? 'Update event' : 'Create event')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
