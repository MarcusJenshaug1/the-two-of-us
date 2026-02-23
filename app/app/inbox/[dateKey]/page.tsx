'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useToast } from '@/components/ui/toast'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Send, Clock, CheckCircle2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

            // 3. Get specific question
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

            if (dqError || !dqData) throw new Error('Question not found')

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

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 h-[calc(100vh-4rem)]">
                <p className="text-zinc-500">{error || 'Question not found'}</p>
                <Button variant="outline" onClick={() => router.push('/app/inbox')}>Go back</Button>
            </div>
        )
    }

    const bothAnswered = myAnswer && partnerAnswer
    const partnerName = partnerProfile?.name || 'Partner'

    return (
        <div className="p-4 space-y-6 pt-4 pb-24 md:pt-8 animate-in fade-in">
            {/* Header */}
            <div className="flex items-center space-x-4 pb-2">
                <button
                    onClick={() => router.push('/app/inbox')}
                    className="p-2 -ml-2 rounded-full hover:bg-zinc-800 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        {format(parseISO(data.date_key), 'MMM d, yyyy')}
                    </h2>
                </div>
            </div>

            {/* Question */}
            <div className="space-y-2 pb-2">
                <h1 className="text-2xl font-semibold leading-tight">{data.text}</h1>
                {data.category && (
                    <span className="inline-block text-[10px] font-medium uppercase tracking-wider text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                        {data.category}
                    </span>
                )}
            </div>

            {/* Answers */}
            <div className="space-y-5">
                {/* YOUR answer or answer form */}
                {myAnswer ? (
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 px-1">
                            <Avatar profile={myProfile} />
                            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">You</span>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                        <div className="relative ml-9">
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl rounded-tl-sm text-[15px] leading-relaxed whitespace-pre-wrap">
                                {myAnswer.answer_text}
                            </div>
                            {/* Partner's reaction on your answer */}
                            {partnerReaction && (
                                <div className="absolute -bottom-3 left-3 flex items-center gap-1 bg-zinc-800 border border-zinc-700/50 rounded-full px-2 py-0.5 shadow-md animate-in fade-in zoom-in duration-200">
                                    <span className="text-sm">
                                        {partnerReaction === 'heart' ? '\u2764\uFE0F' : partnerReaction === 'smile' ? '\uD83D\uDE0A' : '\uD83D\uDD25'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 px-1">
                            <Avatar profile={myProfile} />
                            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">You</span>
                        </div>
                        <form onSubmit={handleSubmitAnswer} className="space-y-3 ml-9">
                            <div className="relative">
                                <textarea
                                    className="w-full min-h-[120px] resize-none rounded-2xl bg-zinc-900 border border-zinc-800 p-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 placeholder:text-zinc-600 transition-all"
                                    placeholder="Type your answer here..."
                                    value={draft}
                                    onChange={handleDraftChange}
                                    disabled={isSubmitting}
                                    maxLength={500}
                                />
                                <div className="absolute bottom-3 right-3 text-xs text-zinc-500">
                                    {draft.length}/500
                                </div>
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-zinc-50"
                                disabled={isSubmitting || draft.length < 10}
                            >
                                {isSubmitting ? 'Sending...' : (
                                    <span className="flex items-center">Send answer <Send className="w-4 h-4 ml-2" /></span>
                                )}
                            </Button>
                        </form>
                    </div>
                )}

                {/* Divider */}
                <div className="border-t border-zinc-800/50" />

                {/* PARTNER answer */}
                {bothAnswered ? (
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 px-1 justify-end">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-sm font-medium text-zinc-300">{partnerName}</span>
                            <Avatar profile={partnerProfile} />
                        </div>
                        <div className="relative mr-9">
                            <div className="bg-zinc-800/50 border border-zinc-700/50 p-4 rounded-2xl rounded-tr-sm text-[15px] leading-relaxed text-zinc-300 whitespace-pre-wrap">
                                {partnerAnswer.answer_text}
                            </div>
                            {/* Your reaction on partner's answer */}
                            <div className="absolute -bottom-3 right-3 flex items-center gap-1">
                                {activeReaction ? (
                                    <button
                                        onClick={() => handleReaction(activeReaction)}
                                        disabled={isSubmittingReaction}
                                        className="group bg-zinc-800 border border-zinc-700/50 rounded-full px-2 py-0.5 shadow-md hover:bg-zinc-700 hover:border-zinc-600 transition-all active:scale-90 animate-in fade-in zoom-in duration-200"
                                    >
                                        <span className="text-sm group-hover:hidden">
                                            {activeReaction === 'heart' ? '\u2764\uFE0F' : activeReaction === 'smile' ? '\uD83D\uDE0A' : '\uD83D\uDD25'}
                                        </span>
                                        <span className="text-xs text-zinc-400 hidden group-hover:inline">\u2715</span>
                                    </button>
                                ) : (
                                    <div className="flex gap-0.5 bg-zinc-800/90 border border-zinc-700/50 rounded-full px-1.5 py-0.5 shadow-md backdrop-blur-sm">
                                        {[
                                            { id: 'heart', emoji: '\u2764\uFE0F' },
                                            { id: 'smile', emoji: '\uD83D\uDE0A' },
                                            { id: 'flame', emoji: '\uD83D\uDD25' }
                                        ].map(({ id, emoji }) => (
                                            <button
                                                key={id}
                                                onClick={() => handleReaction(id)}
                                                disabled={isSubmittingReaction}
                                                className="text-sm px-1 py-0.5 rounded-full hover:bg-zinc-700 transition-all active:scale-90"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : myAnswer && !partnerAnswer ? (
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 px-1 justify-end">
                            <span className="text-sm font-medium text-zinc-500">{partnerName}</span>
                            <Avatar profile={partnerProfile} />
                        </div>
                        <div className="rounded-xl border border-dashed border-zinc-800 p-5 text-center space-y-2 mr-9">
                            <Clock className="h-5 w-5 text-zinc-500 mx-auto" />
                            <p className="text-sm text-zinc-500">Waiting for {partnerName} to answer...</p>
                            <p className="text-xs text-zinc-600">Their answer will appear here once they submit.</p>
                        </div>
                    </div>
                ) : partnerAnswer && !myAnswer ? (
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 px-1 justify-end">
                            <span className="text-sm font-medium text-zinc-500">{partnerName}</span>
                            <Avatar profile={partnerProfile} />
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center space-y-2 mr-9">
                            <p className="text-sm text-amber-400 font-medium">{partnerName} has answered!</p>
                            <p className="text-xs text-zinc-500">Submit your answer above to reveal theirs.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 px-1 justify-end">
                            <span className="text-sm font-medium text-zinc-500">{partnerName}</span>
                            <Avatar profile={partnerProfile} />
                        </div>
                        <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500 text-center mr-9">
                            Hasn&apos;t answered yet.
                        </div>
                    </div>
                )}
            </div>

            {/* ===== CHAT (only when both answered) ===== */}
            {bothAnswered && (
                <div className="space-y-4 pt-4">
                    {/* Chat thread */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-medium uppercase tracking-widest text-zinc-500">Chat</h4>

                        {messages.length > 0 ? (
                            messages.map((msg) => {
                                const isMe = msg.user_id === user!.id
                                const profile = isMe ? myProfile : partnerProfile
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex items-end gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200 ${isMe ? 'flex-row-reverse' : ''}`}
                                    >
                                        <Avatar profile={profile} />
                                        <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${isMe
                                            ? 'bg-rose-600/20 border border-rose-500/20 rounded-br-sm text-zinc-200'
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
                            <p className="text-xs text-zinc-600 text-center py-2">
                                Start a conversation about today&apos;s answers
                            </p>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat input */}
                    <div className="flex items-center gap-2 sticky bottom-20 bg-zinc-950/90 backdrop-blur-sm py-2 -mx-4 px-4">
                        <input
                            type="text"
                            placeholder={`Message ${partnerName}...`}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
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
                            className="p-2.5 rounded-full bg-rose-600 hover:bg-rose-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white transition-colors shrink-0"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
