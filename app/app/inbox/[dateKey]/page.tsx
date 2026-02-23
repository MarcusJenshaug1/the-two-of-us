'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useToast } from '@/components/ui/toast'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { ArrowLeft, Send, Clock, CheckCircle2, User, Camera, X, MessageCircle, BookOpen, CalendarDays, MapPin, Trophy, Star, Lightbulb } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SignedImage } from '@/components/signed-image'

type Profile = {
    name: string | null
    avatar_url: string | null
}

type Message = {
    id: string
    user_id: string
    text: string
    created_at: string
}

type DailyLog = {
    id: string
    user_id: string
    text: string | null
    images: string[]
    date_key: string
}

export default function InboxDetailPage() {
    const [data, setData] = useState<any>(null)
    const [myAnswer, setMyAnswer] = useState<any>(null)
    const [partnerAnswer, setPartnerAnswer] = useState<any>(null)
    const [myProfile, setMyProfile] = useState<Profile | null>(null)
    const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeReaction, setActiveReaction] = useState<string | null>(null)
    const [isSubmittingReaction, setIsSubmittingReaction] = useState(false)
    const [partnerReaction, setPartnerReaction] = useState<string | null>(null)

    // Chat messages
    const [messages, setMessages] = useState<Message[]>([])
    const [chatInput, setChatInput] = useState('')
    const [isSendingMsg, setIsSendingMsg] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Journal state
    const [myLog, setMyLog] = useState<DailyLog | null>(null)
    const [partnerLog, setPartnerLog] = useState<DailyLog | null>(null)
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    // Unified day content
    const [roomId, setRoomId] = useState<string | null>(null)
    const [dayEvents, setDayEvents] = useState<any[]>([])
    const [dayTasks, setDayTasks] = useState<any[]>([])
    const [dayMemories, setDayMemories] = useState<any[]>([])
    const [dayMilestones, setDayMilestones] = useState<any[]>([])
    const [dayDatePlans, setDayDatePlans] = useState<any[]>([])
    const [showSaveMemory, setShowSaveMemory] = useState(false)
    const [memTitle, setMemTitle] = useState('')
    const [memDesc, setMemDesc] = useState('')
    const [memImages, setMemImages] = useState<string[]>([])
    const [isSavingMemory, setIsSavingMemory] = useState(false)

    // Answer form state
    const [draft, setDraft] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const params = useParams()
    const router = useRouter()
    const supabase = createClient()
    const { user } = useAuth()
    const { toast } = useToast()
    const dateKey = params.dateKey as string

    const loadDetail = async () => {
        if (!user) return

        try {
            setIsLoading(true)

            // 1. Get user's room
            const { data: member } = await supabase
                .from('room_members')
                .select('room_id')
                .eq('user_id', user.id)
                .single()

            if (!member) return
            setRoomId(member.room_id)

            // 2. Load profiles of room members
            const { data: members } = await supabase
                .from('room_members')
                .select('user_id, profiles(name, avatar_url)')
                .eq('room_id', member.room_id)

            if (members) {
                for (const m of members) {
                    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                    if (m.user_id === user.id) {
                        setMyProfile(profile as Profile)
                    } else {
                        setPartnerProfile(profile as Profile)
                    }
                }
            }

            // 3. Get specific question (optional - might not exist for future dates)
            const { data: dqData, error: dqError } = await supabase
                .from('daily_questions')
                .select(`
                    id, date_key,
                    questions(text, category),
                    answers(id, user_id, answer_text, created_at, updated_at)
                `)
                .eq('room_id', member.room_id)
                .eq('date_key', dateKey)
                .single()

            // Only set question data if it exists (might be null for future dates)
            if (dqData) {
                setData({
                    id: dqData.id,
                    date_key: dqData.date_key,
                    text: (dqData.questions as any)?.text,
                    category: (dqData.questions as any)?.category,
                })

                const mine = dqData.answers.find((a: any) => a.user_id === user.id)
                const theirs = dqData.answers.find((a: any) => a.user_id !== user.id)

                setMyAnswer(mine || null)
                setPartnerAnswer(theirs || null)

                // 4. If both answered, load reactions + messages
                if (mine && theirs) {
                    const { data: allReactions } = await supabase
                        .from('reactions')
                        .select('*')
                        .eq('daily_question_id', dqData.id)

                    if (allReactions) {
                        const myReaction = allReactions.find((r: any) => r.user_id === user.id)
                        const theirReaction = allReactions.find((r: any) => r.user_id !== user.id)

                        if (myReaction) setActiveReaction(myReaction.emoji)
                        if (theirReaction) setPartnerReaction(theirReaction.emoji)
                    }

                    // Load messages
                    const { data: msgData } = await supabase
                        .from('messages')
                        .select('*')
                        .eq('daily_question_id', dqData.id)
                        .order('created_at', { ascending: true })

                    if (msgData) setMessages(msgData)
                }
                // Load draft
                const savedDraft = localStorage.getItem(`draft_inbox_${dqData.id}`)
                if (savedDraft && !mine) setDraft(savedDraft)
            }

            // 5. Load daily logs for this date
            const { data: logData } = await supabase
                .from('daily_logs')
                .select('*')
                .eq('room_id', member.room_id)
                .eq('date_key', dateKey)

            if (logData) {
                const myEntry = logData.find((l: any) => l.user_id === user.id) as DailyLog | undefined
                const partnerEntry = logData.find((l: any) => l.user_id !== user.id) as DailyLog | undefined
                if (myEntry) setMyLog(myEntry)
                if (partnerEntry) setPartnerLog(partnerEntry)
            }

            // 6. Load planner events for this date
            const { data: evData } = await supabase
                .from('shared_events')
                .select('id, title, location, start_at, all_day')
                .eq('room_id', member.room_id)
                .eq('date_key', dateKey)
                .order('start_at')
            setDayEvents(evData || [])

            // 7. Load tasks due on this date
            const { data: tkData } = await supabase
                .from('shared_tasks')
                .select('id, title, is_done, due_at')
                .eq('room_id', member.room_id)
                .eq('due_date_key', dateKey)
            setDayTasks(tkData || [])

            // 8. Load memories for this date
            const { data: memData } = await supabase
                .from('memories')
                .select('id, title, images, location')
                .eq('room_id', member.room_id)
                .eq('date_key', dateKey)
            setDayMemories(memData || [])

            // 9. Load milestones for this date
            const { data: milData } = await supabase
                .from('milestones')
                .select('id, title, kind')
                .eq('room_id', member.room_id)
                .eq('happened_at', dateKey)
            setDayMilestones(milData || [])

            // 10. Load date plans for this date
            const { data: dpData } = await supabase
                .from('date_completions')
                .select('id, status, date_ideas(title)')
                .eq('room_id', member.room_id)
                .eq('planned_for', dateKey)
                .neq('status', 'skipped')
            setDayDatePlans(dpData || [])

        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadDetail()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, dateKey])

    // Scroll chat to bottom when messages change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Real-time subscription for new messages
    useEffect(() => {
        if (!data?.id) return

        const channel = supabase
            .channel(`messages_${data.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `daily_question_id=eq.${data.id}`,
            }, (payload: any) => {
                setMessages(prev => {
                    if (prev.some(m => m.id === payload.new.id)) return prev
                    return [...prev, payload.new as Message]
                })
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.id])

    // === Answer submission ===
    const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        setDraft(val)
        if (data) localStorage.setItem(`draft_inbox_${data.id}`, val)
    }

    const handleSubmitAnswer = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !data || draft.length < 10) return

        setIsSubmitting(true)
        try {
            const { data: answerData, error: answerErr } = await supabase
                .from('answers')
                .insert({
                    daily_question_id: data.id,
                    user_id: user.id,
                    answer_text: draft
                })
                .select()
                .single()

            if (answerErr) throw answerErr

            setMyAnswer(answerData)
            setDraft('')
            localStorage.removeItem(`draft_inbox_${data.id}`)
        } catch (err: any) {
            toast(err.message || 'Failed to submit answer', 'error')
        } finally {
            setIsSubmitting(false)
        }
    }

    // === Reaction handlers ===
    const handleReaction = async (emoji: string) => {
        if (!data || isSubmittingReaction) return
        setIsSubmittingReaction(true)

        const prevEmoji = activeReaction
        const newEmoji = activeReaction === emoji ? null : emoji
        setActiveReaction(newEmoji)

        try {
            if (newEmoji) {
                await supabase
                    .from('reactions')
                    .upsert({
                        daily_question_id: data.id,
                        user_id: user!.id,
                        emoji: newEmoji,
                    }, { onConflict: 'daily_question_id, user_id' })
            } else {
                await supabase
                    .from('reactions')
                    .delete()
                    .eq('daily_question_id', data.id)
                    .eq('user_id', user!.id)
            }
        } catch (err) {
            console.error('Failed to react', err)
            setActiveReaction(prevEmoji)
        } finally {
            setIsSubmittingReaction(false)
        }
    }

    // === Send message ===
    const sendMessage = async () => {
        if (!data || !chatInput.trim() || isSendingMsg) return
        const text = chatInput.trim()
        setChatInput('')
        setIsSendingMsg(true)

        // Optimistic add
        const optimisticMsg: Message = {
            id: `temp_${Date.now()}`,
            user_id: user!.id,
            text,
            created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, optimisticMsg])

        try {
            const { data: msgData, error: msgErr } = await supabase
                .from('messages')
                .insert({
                    daily_question_id: data.id,
                    user_id: user!.id,
                    text,
                })
                .select()
                .single()

            if (msgErr) throw msgErr

            // Replace optimistic with real
            setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? msgData : m))
        } catch (err: any) {
            // Remove optimistic on error
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
            console.error('Failed to send message', err)
        } finally {
            setIsSendingMsg(false)
        }
    }

    // === Save journal as memory ===
    const handleSaveAsMemory = async () => {
        if (!user || !roomId || !memTitle.trim()) return
        setIsSavingMemory(true)
        try {
            const { error } = await supabase.from('memories').insert({
                room_id: roomId,
                created_by: user.id,
                title: memTitle.trim(),
                description: memDesc.trim() || null,
                happened_at: dateKey,
                date_key: dateKey,
                images: memImages,
                tags: [],
            })
            if (error) throw error
            toast('Saved as memory ✨', 'success')
            setShowSaveMemory(false)
            loadDetail()
        } catch (err: any) {
            toast(err.message || 'Failed to save', 'error')
        } finally {
            setIsSavingMemory(false)
        }
    }

    // === Avatar helper ===
    const Avatar = ({ profile, size = 'sm' }: { profile: Profile | null; size?: 'sm' | 'md' }) => {
        const px = size === 'md' ? 'h-10 w-10' : 'h-7 w-7'
        const iconPx = size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5'
        return (
            <div className={`${px} rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center flex-shrink-0`}>
                {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                    <User className={`${iconPx} text-zinc-500`} />
                )}
            </div>
        )
    }

    const formatDateHeading = (dk: string) => {
        const d = parseISO(dk)
        if (isToday(d)) return 'Today'
        if (isYesterday(d)) return 'Yesterday'
        return format(d, 'EEEE, MMMM d')
    }

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    // Allow showing content even without a question (for future dates with planner/memories/etc)
    if (error && !dayEvents.length && !dayTasks.length && !dayMemories.length && !dayMilestones.length && !dayDatePlans.length) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 h-[calc(100vh-4rem)]">
                <p className="text-zinc-500">{error || 'No content found'}</p>
                <Button variant="outline" onClick={() => router.push('/app/inbox')}>Go back</Button>
            </div>
        )
    }

    const bothAnswered = myAnswer && partnerAnswer
    const partnerName = partnerProfile?.name || 'Partner'
    const hasJournal = myLog || partnerLog
    const hasChat = bothAnswered

    return (
        <div className="min-h-screen pb-28 animate-in fade-in">
            {/* ─── HEADER ─── */}
            <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/50">
                <div className="flex items-center gap-3 px-4 py-3">
                    <button
                        onClick={() => router.push('/app/inbox')}
                        className="p-1.5 -ml-1.5 rounded-full hover:bg-zinc-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{formatDateHeading(data.date_key)}</p>
                        <p className="text-[11px] text-zinc-500">{format(parseISO(data.date_key), 'MMMM d, yyyy')}</p>
                    </div>
                    {data.category && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">
                            {data.category}
                        </span>
                    )}
                </div>
            </div>

            <div className="px-4 pt-6 space-y-6">

                {/* ─── SECTION 1: DAILY QUESTION (only if it exists) ─── */}
                {data && (
                <section>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        {/* Question text */}
                        <div className="p-5 pb-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/70 mb-2">Daily Question</p>
                            <h1 className="text-lg font-semibold leading-snug">{data.text}</h1>
                        </div>

                        <div className="border-t border-zinc-800/50" />

                        {/* Your answer */}
                        <div className="p-4">
                            {myAnswer ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Avatar profile={myProfile} />
                                        <span className="text-xs font-semibold text-rose-400">You</span>
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                        {partnerReaction && (
                                            <span className="ml-auto text-sm">
                                                {partnerReaction === 'heart' ? '❤️' : partnerReaction === 'smile' ? '😊' : '🔥'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[15px] text-zinc-300 leading-relaxed whitespace-pre-wrap pl-9">
                                        {myAnswer.answer_text}
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmitAnswer} className="space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Avatar profile={myProfile} />
                                        <span className="text-xs font-semibold text-rose-400">Your answer</span>
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            className="w-full min-h-[100px] resize-none rounded-xl bg-zinc-950 border border-zinc-800 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600 transition-all"
                                            placeholder="Type your answer here..."
                                            value={draft}
                                            onChange={handleDraftChange}
                                            disabled={isSubmitting}
                                            maxLength={500}
                                        />
                                        <span className="absolute bottom-2 right-3 text-[10px] text-zinc-600">{draft.length}/500</span>
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full h-10 bg-rose-600 hover:bg-rose-700 text-white text-sm"
                                        disabled={isSubmitting || draft.length < 10}
                                    >
                                        {isSubmitting ? 'Sending...' : (
                                            <span className="flex items-center gap-2"><Send className="w-4 h-4" /> Send answer</span>
                                        )}
                                    </Button>
                                </form>
                            )}
                        </div>

                        <div className="border-t border-zinc-800/50" />

                        {/* Partner answer */}
                        <div className="p-4">
                            {bothAnswered ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Avatar profile={partnerProfile} />
                                        <span className="text-xs font-semibold text-zinc-400">{partnerName}</span>
                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                        {/* Reaction picker */}
                                        <div className="ml-auto flex items-center">
                                            {activeReaction ? (
                                                <button
                                                    onClick={() => handleReaction(activeReaction)}
                                                    disabled={isSubmittingReaction}
                                                    className="text-sm hover:opacity-70 transition-opacity active:scale-90"
                                                    title="Remove reaction"
                                                >
                                                    {activeReaction === 'heart' ? '❤️' : activeReaction === 'smile' ? '😊' : '🔥'}
                                                </button>
                                            ) : (
                                                <div className="flex gap-1">
                                                    {[
                                                        { id: 'heart', emoji: '❤️' },
                                                        { id: 'smile', emoji: '😊' },
                                                        { id: 'flame', emoji: '🔥' },
                                                    ].map(({ id, emoji }) => (
                                                        <button
                                                            key={id}
                                                            onClick={() => handleReaction(id)}
                                                            disabled={isSubmittingReaction}
                                                            className="text-sm opacity-40 hover:opacity-100 transition-opacity active:scale-90"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-[15px] text-zinc-300 leading-relaxed whitespace-pre-wrap pl-9">
                                        {partnerAnswer.answer_text}
                                    </p>
                                </div>
                            ) : partnerAnswer && !myAnswer ? (
                                <div className="flex items-center gap-3 py-2">
                                    <Avatar profile={partnerProfile} />
                                    <div>
                                        <p className="text-sm font-medium text-amber-400">{partnerName} has answered!</p>
                                        <p className="text-xs text-zinc-500">Answer above to reveal theirs.</p>
                                    </div>
                                </div>
                            ) : myAnswer && !partnerAnswer ? (
                                <div className="flex items-center gap-3 py-2">
                                    <Avatar profile={partnerProfile} />
                                    <div>
                                        <p className="text-sm text-zinc-400">{partnerName}</p>
                                        <p className="text-xs text-zinc-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Waiting for answer...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 py-2">
                                    <Avatar profile={partnerProfile} />
                                    <div>
                                        <p className="text-sm text-zinc-400">{partnerName}</p>
                                        <p className="text-xs text-zinc-600">Hasn&apos;t answered yet</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
                )}

                {/* ─── SECTION 2: CHAT ─── */}
                {hasChat && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <MessageCircle className="w-3.5 h-3.5 text-zinc-500" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Chat</h3>
                            {messages.length > 0 && (
                                <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full">{messages.length}</span>
                            )}
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                            {/* Messages */}
                            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                                {messages.length > 0 ? (
                                    messages.map((msg) => {
                                        const isMe = msg.user_id === user!.id
                                        const profile = isMe ? myProfile : partnerProfile
                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex items-end gap-2 animate-in fade-in duration-200 ${isMe ? 'flex-row-reverse' : ''}`}
                                            >
                                                <Avatar profile={profile} />
                                                <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${isMe
                                                    ? 'bg-rose-600/15 border border-rose-500/15 rounded-br-sm text-zinc-200'
                                                    : 'bg-zinc-800 border border-zinc-700/50 rounded-bl-sm text-zinc-300'
                                                }`}>
                                                    {msg.text}
                                                </div>
                                                <span className="text-[10px] text-zinc-600 shrink-0">
                                                    {format(parseISO(msg.created_at), 'HH:mm')}
                                                </span>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <p className="text-xs text-zinc-600 text-center py-4">
                                        Start a conversation about this question ✨
                                    </p>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Chat input */}
                            <div className="flex items-center gap-2 p-3 border-t border-zinc-800/50">
                                <input
                                    type="text"
                                    placeholder={`Message ${partnerName}...`}
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-full py-2 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            sendMessage()
                                        }
                                    }}
                                    maxLength={500}
                                    disabled={isSendingMsg}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!chatInput.trim() || isSendingMsg}
                                    className="p-2 rounded-full bg-rose-600 hover:bg-rose-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-colors shrink-0"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* ─── SECTION 3: JOURNAL ─── */}
                {hasJournal && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Journal</h3>
                        </div>

                        <div className="space-y-3">
                            {[myLog, partnerLog].filter(Boolean).map((log) => {
                                const isMe = log!.user_id === user!.id
                                const profile = isMe ? myProfile : partnerProfile
                                const name = isMe ? 'You' : partnerName
                                const hasImages = log!.images && log!.images.length > 0
                                return (
                                    <div key={log!.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                                        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                                            <Avatar profile={profile} />
                                            <span className={`text-xs font-semibold ${isMe ? 'text-rose-400' : 'text-zinc-400'}`}>{name}</span>
                                            {hasImages && (
                                                <span className="ml-auto flex items-center gap-0.5 text-[10px] text-zinc-600">
                                                    <Camera className="w-3 h-3" /> {log!.images.length}
                                                </span>
                                            )}
                                        </div>
                                        <div className="px-4 pb-4 space-y-3">
                                            {log!.text && (
                                                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{log!.text}</p>
                                            )}
                                            {hasImages && (
                                                <div className={`grid gap-1.5 ${log!.images.length === 1 ? 'grid-cols-1' : log!.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                                    {log!.images.map((url, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => setPreviewImage(url)}
                                                            className="aspect-square rounded-xl overflow-hidden bg-zinc-800"
                                                        >
                                                            <img src={url} alt="" className="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* ─── SECTION 4: PLANNER ─── */}
                {(dayEvents.length > 0 || dayTasks.length > 0) && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <CalendarDays className="w-3.5 h-3.5 text-zinc-500" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Planner</h3>
                        </div>
                        <div className="space-y-2">
                            {dayEvents.map((ev: any) => (
                                <div key={ev.id} className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                    <CalendarDays className="w-4 h-4 text-blue-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{ev.title}</p>
                                        <p className="text-xs text-zinc-500">
                                            {ev.all_day ? 'All day' : format(parseISO(ev.start_at), 'HH:mm')}
                                            {ev.location && ` · ${ev.location}`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {dayTasks.map((task: any) => (
                                <div key={task.id} className="flex items-center gap-3 p-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl">
                                    {task.is_done
                                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                        : <Clock className="w-4 h-4 text-zinc-600 shrink-0" />
                                    }
                                    <p className={`text-sm flex-1 truncate ${task.is_done ? 'text-zinc-500 line-through' : ''}`}>{task.title}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ─── SECTION 5: MEMORIES ─── */}
                {dayMemories.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Star className="w-3.5 h-3.5 text-zinc-500" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Memories</h3>
                        </div>
                        <div className="space-y-2">
                            {dayMemories.map((mem: any) => (
                                <Link key={mem.id} href={`/app/memories/${mem.id}`} className="block group">
                                    <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl hover:border-amber-500/30 transition-colors">
                                        <Star className="w-4 h-4 text-amber-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{mem.title}</p>
                                            {mem.location && <p className="text-xs text-zinc-500">{mem.location}</p>}
                                        </div>
                                        {mem.images?.length > 0 && (
                                            <span className="text-[10px] text-amber-400 flex items-center gap-0.5 shrink-0">
                                                <Camera className="w-3 h-3" /> {mem.images.length}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* ─── SECTION 6: MILESTONES ─── */}
                {dayMilestones.length > 0 && (
                    <section>
                        <div className="space-y-2">
                            {dayMilestones.map((ms: any) => (
                                <div key={ms.id} className="flex items-center gap-3 p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                                    <Trophy className="w-4 h-4 text-purple-400 shrink-0" />
                                    <p className="text-sm font-medium">{ms.title}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ─── SECTION 7: DATE PLANS ─── */}
                {dayDatePlans.length > 0 && (
                    <section>
                        <div className="space-y-2">
                            {dayDatePlans.map((dp: any) => (
                                <div key={dp.id} className="flex items-center gap-3 p-3 bg-pink-500/5 border border-pink-500/10 rounded-xl">
                                    <Lightbulb className={`w-4 h-4 shrink-0 ${dp.status === 'done' ? 'text-emerald-400' : 'text-pink-400'}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{dp.date_ideas?.title || 'Date idea'}</p>
                                        <p className="text-[10px] text-zinc-500">{dp.status === 'done' ? 'Completed ✓' : 'Planned'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ─── SAVE AS MEMORY CTA ─── */}
                {(() => {
                    const hasJournalContent = (myLog?.text || (myLog?.images && myLog.images.length > 0)) || (partnerLog?.text || (partnerLog?.images && partnerLog.images.length > 0))
                    return hasJournalContent && dayMemories.length === 0 && !showSaveMemory ? (
                        <button
                            onClick={() => {
                                const journal = myLog || partnerLog
                                setMemTitle(`Memory from ${formatDateHeading(dateKey)}`)
                                setMemDesc(journal?.text || '')
                                setMemImages(journal?.images || [])
                                setShowSaveMemory(true)
                            }}
                            className="w-full flex items-center justify-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-amber-400 text-sm font-medium hover:border-amber-500/40 transition-colors"
                        >
                            <Star className="w-4 h-4" /> Save journal as memory
                        </button>
                    ) : null
                })()}
            </div>

            {/* ─── SAVE AS MEMORY MODAL ─── */}
            {showSaveMemory && (
                <div
                    className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => setShowSaveMemory(false)}
                >
                    <div
                        className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Save as Memory</h3>
                            <button onClick={() => setShowSaveMemory(false)} className="p-1.5 rounded-lg hover:bg-zinc-800" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={memTitle}
                                onChange={e => setMemTitle(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-zinc-600"
                                placeholder="Title *"
                                maxLength={120}
                            />
                            <textarea
                                value={memDesc}
                                onChange={e => setMemDesc(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-zinc-600 resize-none min-h-[80px]"
                                placeholder="Description"
                                maxLength={1000}
                            />
                            {memImages.length > 0 && (
                                <div className="flex gap-1.5">
                                    {memImages.map((url: string, i: number) => (
                                        <SignedImage key={i} path={url} alt="" className="w-14 h-14 rounded-lg object-cover" />
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button
                            onClick={handleSaveAsMemory}
                            disabled={!memTitle.trim() || isSavingMemory}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isSavingMemory ? 'Saving...' : 'Save memory'}
                        </Button>
                    </div>
                </div>
            )}

            {/* ─── FULLSCREEN IMAGE PREVIEW ─── */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-700 transition-colors z-10"
                        onClick={() => setPreviewImage(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <SignedImage
                        path={previewImage}
                        alt=""
                        className="max-h-[85vh] max-w-full rounded-2xl object-contain animate-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    )
}
