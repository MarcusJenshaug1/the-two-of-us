'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, MessageCircle, Heart, Smile, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function InboxDetailPage() {
    const [data, setData] = useState<any>(null)
    const [myAnswer, setMyAnswer] = useState<any>(null)
    const [partnerAnswer, setPartnerAnswer] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeReaction, setActiveReaction] = useState<string | null>(null)
    const [comment, setComment] = useState('')
    const [isSubmittingReaction, setIsSubmittingReaction] = useState(false)

    const params = useParams()
    const router = useRouter()
    const supabase = createClient()
    const { user } = useAuth()
    const dateKey = params.dateKey as string

    useEffect(() => {
        if (!user) return
        let mounted = true

        const loadDetail = async () => {
            try {
                // 1. Get user's room
                const { data: member } = await supabase
                    .from('room_members')
                    .select('room_id')
                    .eq('user_id', user.id)
                    .single()

                if (!member) return

                // 2. Get specific question
                const { data: dqData, error: dqError } = await supabase
                    .from('daily_questions')
                    .select(`
            id, date_key, 
            questions(text), 
            answers(id, user_id, answer_text, created_at, updated_at)
          `)
                    .eq('room_id', member.room_id)
                    .eq('date_key', dateKey)
                    .single()

                if (!mounted) return
                if (dqError || !dqData) throw new Error('Question not found')

                setData({
                    id: dqData.id,
                    date_key: dqData.date_key,
                    text: (dqData.questions as any)?.text
                })

                const mine = dqData.answers.find((a: any) => a.user_id === user.id)
                const theirs = dqData.answers.find((a: any) => a.user_id !== user.id)

                setMyAnswer(mine)
                setPartnerAnswer(theirs)

                // 3. If both answered, load reactions
                if (mine && theirs) {
                    const { data: reactionsData } = await supabase
                        .from('reactions')
                        .select('*')
                        .eq('daily_question_id', dqData.id)
                        .eq('user_id', user.id)
                        .single()

                    if (reactionsData) {
                        setActiveReaction(reactionsData.emoji)
                        if (reactionsData.comment) setComment(reactionsData.comment)
                    }
                }

            } catch (err: any) {
                setError(err.message)
            } finally {
                if (mounted) setIsLoading(false)
            }
        }

        loadDetail()
        return () => { mounted = false }
    }, [user, dateKey, supabase])

    const handleReaction = async (emoji: string) => {
        if (!data || isSubmittingReaction) return
        setIsSubmittingReaction(true)

        try {
            const newEmoji = activeReaction === emoji ? null : emoji
            setActiveReaction(newEmoji)

            if (newEmoji) {
                // Upsert reaction
                const { error } = await supabase
                    .from('reactions')
                    .upsert({
                        daily_question_id: data.id,
                        user_id: user!.id,
                        emoji: newEmoji,
                        comment: comment.trim() || null
                    }, { onConflict: 'daily_question_id, user_id' })
                if (error) throw error
            } else {
                // Delete reaction if unselecting and no comment exists
                if (!comment.trim()) {
                    await supabase
                        .from('reactions')
                        .delete()
                        .eq('daily_question_id', data.id)
                        .eq('user_id', user!.id)
                } else {
                    await supabase
                        .from('reactions')
                        .upsert({
                            daily_question_id: data.id,
                            user_id: user!.id,
                            emoji: null,
                            comment: comment.trim()
                        }, { onConflict: 'daily_question_id, user_id' })
                }
            }
        } catch (err) {
            console.error('Failed to react', err)
            // Revert optimism
            setActiveReaction(activeReaction)
        } finally {
            setIsSubmittingReaction(false)
        }
    }

    const handleCommentBlur = async () => {
        if (!data) return
        try {
            if (comment.trim() || activeReaction) {
                await supabase
                    .from('reactions')
                    .upsert({
                        daily_question_id: data.id,
                        user_id: user!.id,
                        emoji: activeReaction,
                        comment: comment.trim() || null
                    }, { onConflict: 'daily_question_id, user_id' })
            } else {
                await supabase
                    .from('reactions')
                    .delete()
                    .eq('daily_question_id', data.id)
                    .eq('user_id', user!.id)
            }
        } catch (err) {
            console.error('Failed to save comment', err)
        }
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

    return (
        <div className="p-4 space-y-6 pt-4 pb-24 md:pt-8 animate-in fade-in">
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

            <div className="space-y-2 pb-4">
                <h1 className="text-2xl font-semibold leading-tight">{data.text}</h1>
            </div>

            <div className="space-y-6">
                {/* Your Answer */}
                {myAnswer ? (
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-rose-500 px-2">You</h3>
                        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl md:rounded-3xl rounded-tr-sm text-[15px] leading-relaxed relative">
                            {myAnswer.answer_text}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-500 text-center">
                        You missed this question.
                    </div>
                )}

                {/* Partner Answer */}
                {bothAnswered ? (
                    <div className="space-y-3 pt-2">
                        <h3 className="text-sm font-medium text-zinc-400 px-2 text-right">Partner</h3>
                        <div className="bg-zinc-800/50 border border-zinc-700/50 p-5 rounded-2xl md:rounded-3xl rounded-tl-sm text-[15px] leading-relaxed relative text-zinc-300">
                            {partnerAnswer.answer_text}
                        </div>

                        {/* Reactions (Only shown when both answered) */}
                        <div className="pt-8 space-y-4">
                            <h4 className="text-xs font-medium uppercase tracking-widest text-zinc-500">Respond</h4>
                            <div className="flex space-x-3">
                                {[
                                    { icon: Heart, id: 'heart', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/30' },
                                    { icon: Smile, id: 'smile', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' },
                                    { icon: Flame, id: 'flame', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/30' }
                                ].map(({ icon: Icon, id, color, bg }) => {
                                    const isActive = activeReaction === id
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => handleReaction(id)}
                                            disabled={isSubmittingReaction}
                                            className={`p-3 rounded-full border transition-all ${isActive
                                                    ? `${bg} ${color}`
                                                    : 'border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                                                }`}
                                        >
                                            <Icon className="w-5 h-5" fill={isActive ? 'currentColor' : 'none'} />
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="relative pt-2">
                                <div className="absolute top-5 left-3 text-zinc-500">
                                    <MessageCircle className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Add a short comment..."
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    onBlur={handleCommentBlur}
                                    maxLength={100}
                                />
                            </div>
                        </div>
                    </div>
                ) : partnerAnswer ? (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-500 text-center">
                        Your partner answered, but you need to answer (or missed) to see it.
                    </div>
                ) : (
                    <div className="p-4 rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-500 text-center">
                        Partner missed this question.
                    </div>
                )}
            </div>
        </div>
    )
}
