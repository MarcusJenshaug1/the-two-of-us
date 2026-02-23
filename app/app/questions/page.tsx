'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { formatInTimeZone } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock, Send, AlertTriangle, User } from 'lucide-react'
import Link from 'next/link'

const TIMEZONE = 'Europe/Oslo'

function getDateKey() {
    const now = new Date()
    const osloHour = parseInt(formatInTimeZone(now, TIMEZONE, 'HH'), 10)
    const businessDate = osloHour < 6
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
        : now
    return formatInTimeZone(businessDate, TIMEZONE, 'yyyy-MM-dd')
}

export default function QuestionsPage() {
    const [dailyQuestion, setDailyQuestion] = useState<any>(null)
    const [myAnswer, setMyAnswer] = useState<any>(null)
    const [partnerAnswer, setPartnerAnswer] = useState<any>(null)
    const [draft, setDraft] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [partnerName, setPartnerName] = useState<string>('Partner')
    const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null)

    const supabase = createClient()
    const { user } = useAuth()
    const dateKey = getDateKey()

    const loadData = useCallback(async () => {
        if (!user) return

        try {
            setIsLoading(true)
            setErrorMsg(null)

            // 1. Get user's room
            const { data: member, error: memberErr } = await supabase
                .from('room_members')
                .select('room_id')
                .eq('user_id', user.id)
                .single()

            if (!member) {
                console.error('No room membership found', memberErr)
                return
            }

            const roomId = member.room_id

            // Load partner profile
            const { data: members } = await supabase
                .from('room_members')
                .select('user_id, profiles(name, avatar_url)')
                .eq('room_id', roomId)

            if (members) {
                const partner = members.find((m: any) => m.user_id !== user.id)
                if (partner) {
                    const profile = Array.isArray(partner.profiles) ? partner.profiles[0] : partner.profiles
                    if (profile?.name) setPartnerName(profile.name)
                    if (profile?.avatar_url) setPartnerAvatar(profile.avatar_url)
                }
            }

            let dq: any = null

            // === STRATEGY 1: Try the RPC (cleanest path) ===
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('ensure_daily_question', { room_id_param: roomId })

            if (!rpcError && rpcData && rpcData.length > 0) {
                dq = rpcData[0]
            } else {
                if (rpcError) console.warn('RPC unavailable:', rpcError.message)

                // === STRATEGY 2: Check for existing daily question ===
                const { data: existing } = await supabase
                    .from('daily_questions')
                    .select('id, question_id, date_key, questions(text, category)')
                    .eq('room_id', roomId)
                    .eq('date_key', dateKey)
                    .maybeSingle()

                if (existing) {
                    dq = {
                        id: existing.id,
                        question_id: existing.question_id,
                        date_key: existing.date_key,
                        question_text: (existing.questions as any)?.text,
                        question_category: (existing.questions as any)?.category,
                    }
                } else {
                    // === STRATEGY 3: Create daily question from client ===
                    // Get question IDs already used by this room (never-repeat)
                    const { data: usedData } = await supabase
                        .from('daily_questions')
                        .select('question_id')
                        .eq('room_id', roomId)

                    const usedIds = new Set((usedData || []).map((d: any) => d.question_id))

                    // Fetch all questions
                    const { data: allQuestions } = await supabase
                        .from('questions')
                        .select('id, text, category')

                    if (!allQuestions || allQuestions.length === 0) {
                        setErrorMsg('No questions in the database. Run the migration SQL in Supabase first.')
                        return
                    }

                    // Pick a random UNUSED question
                    let available = allQuestions.filter((q: any) => !usedIds.has(q.id))
                    if (available.length === 0) available = allQuestions // wrap around
                    const pick = available[Math.floor(Math.random() * available.length)]

                    // Insert the daily question
                    const { error: insertErr } = await supabase
                        .from('daily_questions')
                        .insert({
                            room_id: roomId,
                            question_id: pick.id,
                            date_key: dateKey
                        })

                    if (insertErr) {
                        console.warn('Direct insert failed:', insertErr.message)
                        // Race condition? Partner may have created it — try reading again
                        const { data: retry } = await supabase
                            .from('daily_questions')
                            .select('id, question_id, date_key, questions(text, category)')
                            .eq('room_id', roomId)
                            .eq('date_key', dateKey)
                            .maybeSingle()

                        if (retry) {
                            dq = {
                                id: retry.id,
                                question_id: retry.question_id,
                                date_key: retry.date_key,
                                question_text: (retry.questions as any)?.text,
                                question_category: (retry.questions as any)?.category,
                            }
                        } else {
                            setErrorMsg('Could not create today\'s question. Check that the database migration has been run.')
                            return
                        }
                    } else {
                        // Re-fetch the inserted question with full join data
                        const { data: inserted } = await supabase
                            .from('daily_questions')
                            .select('id, question_id, date_key, questions(text, category)')
                            .eq('room_id', roomId)
                            .eq('date_key', dateKey)
                            .single()

                        if (inserted) {
                            dq = {
                                id: inserted.id,
                                question_id: inserted.question_id,
                                date_key: inserted.date_key,
                                question_text: (inserted.questions as any)?.text,
                                question_category: (inserted.questions as any)?.category,
                            }
                        }
                    }
                }
            }

            if (dq) {
                setDailyQuestion({
                    id: dq.id,
                    question_id: dq.question_id,
                    date_key: dq.date_key,
                    text: dq.question_text,
                    category: dq.question_category,
                })

                // Restore draft from localStorage
                const savedDraft = localStorage.getItem(`draft_${dq.id}`)
                if (savedDraft) setDraft(savedDraft)

                // Load answers
                const { data: answers } = await supabase
                    .from('answers')
                    .select('*')
                    .eq('daily_question_id', dq.id)

                if (answers) {
                    setMyAnswer(answers.find((a: any) => a.user_id === user.id) || null)
                    setPartnerAnswer(answers.find((a: any) => a.user_id !== user.id) || null)
                }
            }
        } catch (err) {
            console.error('Error loading question data', err)
            setErrorMsg('Something went wrong. Please reload the page.')
        } finally {
            setIsLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, dateKey])

    useEffect(() => {
        loadData()
    }, [loadData])

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

    if (errorMsg) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 h-[calc(100vh-4rem)]">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <h2 className="text-xl font-semibold">Setup Required</h2>
                <p className="text-sm text-zinc-400 max-w-sm">{errorMsg}</p>
                <Button onClick={() => window.location.reload()} variant="outline">
                    Reload Page
                </Button>
            </div>
        )
    }

    if (!dailyQuestion) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 h-[calc(100vh-4rem)]">
                <Clock className="h-12 w-12 text-zinc-500" />
                <h2 className="text-xl font-semibold">No question yet</h2>
                <p className="text-sm text-zinc-400">
                    Check back later today. New questions appear at 06:00 Oslo time.
                </p>
                <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                    Try Again
                </Button>
            </div>
        )
    }

    const bothAnswered = myAnswer && partnerAnswer

    return (
        <div className="p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <h1 className="text-xs font-bold uppercase tracking-widest text-rose-500">Today&apos;s Question</h1>
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
                        <p className="text-sm text-zinc-400 mt-1">Both of you have answered today&apos;s question.</p>
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
                        <div className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {partnerAvatar ? (
                                <img src={partnerAvatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <User className="h-3.5 w-3.5 text-zinc-500" />
                            )}
                        </div>
                        <span className="text-sm">Waiting for {partnerName}...</span>
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
