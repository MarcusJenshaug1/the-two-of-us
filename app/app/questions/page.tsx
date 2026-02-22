'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { format, formatInTimeZone } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock, Send } from 'lucide-react'
import Link from 'next/link'

// OSLO timezone for consistency
const TIMEZONE = 'Europe/Oslo'

export default function QuestionsPage() {
    const [dailyQuestion, setDailyQuestion] = useState<any>(null)
    const [myAnswer, setMyAnswer] = useState<any>(null)
    const [partnerAnswer, setPartnerAnswer] = useState<any>(null)
    const [draft, setDraft] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const supabase = createClient()
    const { user } = useAuth()

    // Get current date key in Oslo time
    const today = new Date()
    // If before 06:00, it belongs to the previous "business day"
    const osloHour = parseInt(formatInTimeZone(today, TIMEZONE, 'HH'), 10)
    const businessDate = osloHour < 6
        ? new Date(today.getTime() - 24 * 60 * 60 * 1000)
        : today
    const dateKey = formatInTimeZone(businessDate, TIMEZONE, 'yyyy-MM-dd')

    useEffect(() => {
        if (!user) return
        let mounted = true

        const loadData = async () => {
            try {
                setIsLoading(true)

                // 1. Get user's room
                const { data: member } = await supabase
                    .from('room_members')
                    .select('room_id')
                    .eq('user_id', user.id)
                    .single()

                if (!member) return

                const roomId = member.room_id

                // 2. Ensure today's question exists (auto-generates if needed)
                const { data: dqRows, error: rpcError } = await supabase
                    .rpc('ensure_daily_question', { room_id_param: roomId })

                if (rpcError) {
                    console.error('RPC error:', rpcError)
                }

                if (!mounted) return

                const dq = dqRows?.[0]
                if (dq) {
                    setDailyQuestion({
                        id: dq.id,
                        question_id: dq.question_id,
                        date_key: dq.date_key,
                        text: dq.question_text,
                        category: dq.question_category,
                    })

                    // Load draft
                    const savedDraft = localStorage.getItem(`draft_${dq.id}`)
                    if (savedDraft) setDraft(savedDraft)

                    // 3. Get answers for this daily_question
                    const { data: answers } = await supabase
                        .from('answers')
                        .select('*')
                        .eq('daily_question_id', dq.id)

                    if (answers) {
                        const mine = answers.find((a: any) => a.user_id === user.id)
                        const theirs = answers.find((a: any) => a.user_id !== user.id)
                        setMyAnswer(mine)
                        setPartnerAnswer(theirs)
                    }
                }
            } catch (err) {
                console.error('Error loading question data', err)
            } finally {
                if (mounted) setIsLoading(false)
            }
        }

        loadData()
        return () => { mounted = false }
    }, [user, dateKey, supabase])

    const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        setDraft(val)
        if (dailyQuestion) {
            localStorage.setItem(`draft_${dailyQuestion.id}`, val)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !dailyQuestion || draft.length < 10) return

        setIsSubmitting(true)
        try {
            const { data, error } = await supabase
                .from('answers')
                .insert({
                    daily_question_id: dailyQuestion.id,
                    user_id: user.id,
                    answer_text: draft
                })
                .select()
                .single()

            if (error) throw error

            setMyAnswer(data)
            localStorage.removeItem(`draft_${dailyQuestion.id}`)
        } catch (err: any) {
            alert(err.message || 'Failed to submit answer')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    if (!dailyQuestion) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 h-[calc(100vh-4rem)]">
                <Clock className="h-12 w-12 text-zinc-500" />
                <h2 className="text-xl font-semibold">No question yet</h2>
                <p className="text-sm text-zinc-400">
                    Check back later today. New questions are generated at 06:00 Oslo time.
                </p>
            </div>
        )
    }

    const bothAnswered = myAnswer && partnerAnswer

    return (
        <div className="p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <h1 className="text-xs font-bold uppercase tracking-widest text-rose-500">Today's Question</h1>
                    {dailyQuestion.category && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                            {dailyQuestion.category}
                        </span>
                    )}
                </div>
                <p className="text-2xl md:text-3xl font-semibold leading-tight">{dailyQuestion.text}</p>
                <p className="text-sm text-zinc-500">{formatInTimeZone(new Date(), TIMEZONE, 'EEEE, MMM d')}</p>
            </div>

            {bothAnswered ? (
                <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 text-center space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-rose-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium">Day Completed</h3>
                        <p className="text-sm text-zinc-400 mt-1">Both of you have answered today's question.</p>
                    </div>
                    <Link href={`/app/inbox/${dateKey}`} className="block">
                        <Button className="w-full bg-rose-600 hover:bg-rose-700 text-zinc-50 mt-4">
                            View Answers
                        </Button>
                    </Link>
                </div>
            ) : myAnswer ? (
                <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-6 space-y-4">
                    <div className="flex items-center space-x-3 text-zinc-300">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        <span className="font-medium text-sm">You answered</span>
                    </div>
                    <div className="text-sm text-zinc-400 bg-zinc-950 p-4 rounded-lg border border-zinc-800/50 whitespace-pre-wrap">
                        {myAnswer.answer_text}
                    </div>

                    <div className="flex items-center space-x-3 text-zinc-500 pt-4 border-t border-zinc-800/50">
                        <Clock className="h-5 w-5" />
                        <span className="text-sm">Waiting for partner...</span>
                    </div>
                    <p className="text-xs text-zinc-600">Their answer stays hidden until they submit.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <textarea
                            className="w-full min-h-[160px] resize-none rounded-2xl bg-zinc-900 border border-zinc-800 p-4 text-base focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 placeholder:text-zinc-600 transition-all"
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
                        className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-zinc-50 transition-colors"
                        disabled={isSubmitting || draft.length < 10}
                    >
                        {isSubmitting ? 'Sending...' : (
                            <span className="flex items-center">
                                Send answer <Send className="w-4 h-4 ml-2" />
                            </span>
                        )}
                    </Button>
                    <p className="text-xs text-center text-zinc-500">
                        Min 10 characters. Saved locally as draft.
                    </p>
                </form>
            )}
        </div>
    )
}
