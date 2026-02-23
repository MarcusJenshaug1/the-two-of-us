'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, CircleDashed, ArrowRight, Send } from 'lucide-react'

type InboxItem = {
    id: string
    date_key: string
    text: string
    category: string | null
    status: 'completed' | 'your_turn' | 'waiting' | 'unanswered'
}

export default function InboxPage() {
    const [history, setHistory] = useState<InboxItem[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const supabase = createClient()
    const { user } = useAuth()

    useEffect(() => {
        if (!user) return
        let mounted = true

        const loadInbox = async () => {
            try {
                // 1. Get user's room
                const { data: member } = await supabase
                    .from('room_members')
                    .select('room_id')
                    .eq('user_id', user.id)
                    .single()

                if (!member) return

                // 2. Get past questions with answers
                const { data: dqData } = await supabase
                    .from('daily_questions')
                    .select(`
                        id, date_key, question_id,
                        questions(text, category),
                        answers(user_id)
                    `)
                    .eq('room_id', member.room_id)
                    .order('date_key', { ascending: false })
                    .limit(50)

                if (!mounted || !dqData) return

                // Process data with detailed status
                const processed: InboxItem[] = dqData.map((item: any) => {
                    const myAnswer = item.answers?.find((a: any) => a.user_id === user.id)
                    const theirAnswer = item.answers?.find((a: any) => a.user_id !== user.id)

                    let status: InboxItem['status']
                    if (myAnswer && theirAnswer) {
                        status = 'completed'
                    } else if (theirAnswer && !myAnswer) {
                        status = 'your_turn' // Partner answered, you haven't
                    } else if (myAnswer && !theirAnswer) {
                        status = 'waiting' // You answered, waiting for partner
                    } else {
                        status = 'unanswered' // Neither answered
                    }

                    return {
                        id: item.id,
                        date_key: item.date_key,
                        text: item.questions?.text || 'Unknown question',
                        category: item.questions?.category || null,
                        status
                    }
                })

                setHistory(processed)
            } catch (err) {
                console.error('Error loading inbox', err)
            } finally {
                if (mounted) setIsLoading(false)
            }
        }

        loadInbox()
        return () => { mounted = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    const yourTurnItems = history.filter(i => i.status === 'your_turn')
    const otherItems = history.filter(i => i.status !== 'your_turn')

    return (
        <div className="p-4 space-y-6 pt-8 md:pt-12 pb-24">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
                <p className="text-sm text-zinc-400">Past questions and answers.</p>
            </div>

            {/* YOUR TURN section — unanswered questions where partner already answered */}
            {yourTurnItems.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-rose-500">
                        Your Turn ({yourTurnItems.length})
                    </h2>
                    {yourTurnItems.map((item) => (
                        <Link
                            key={item.id}
                            href={`/app/inbox/${item.date_key}`}
                            className="block group"
                        >
                            <div className="flex items-start space-x-4 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 hover:border-rose-500/50 transition-colors">
                                <div className="pt-1">
                                    <div className="relative">
                                        <Send className="h-5 w-5 text-rose-500" />
                                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-rose-500 rounded-full animate-pulse" />
                                    </div>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-snug group-hover:text-rose-400 transition-colors line-clamp-2">
                                        {item.text}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-zinc-500">
                                            {format(parseISO(item.date_key), 'MMM d, yyyy')}
                                        </p>
                                        {item.category && (
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                                                {item.category}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-rose-500/50 mt-1.5 group-hover:text-rose-400 transition-colors" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* ALL QUESTIONS history */}
            <div className="space-y-3">
                {yourTurnItems.length > 0 && otherItems.length > 0 && (
                    <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        History
                    </h2>
                )}

                {history.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 text-sm border border-zinc-800 border-dashed rounded-xl">
                        No history yet. Start answering daily questions!
                    </div>
                ) : (
                    otherItems.map((item) => (
                        <Link
                            key={item.id}
                            href={`/app/inbox/${item.date_key}`}
                            className="block group"
                        >
                            <div className="flex items-start space-x-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 transition-colors">
                                <div className="pt-1">
                                    {item.status === 'completed' ? (
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                    ) : item.status === 'waiting' ? (
                                        <CircleDashed className="h-5 w-5 text-amber-500" />
                                    ) : (
                                        <CircleDashed className="h-5 w-5 text-zinc-700" />
                                    )}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-snug group-hover:text-rose-400 transition-colors line-clamp-2">
                                        {item.text}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-zinc-500">
                                            {format(parseISO(item.date_key), 'MMM d, yyyy')}
                                        </p>
                                        {item.category && (
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                                                {item.category}
                                            </span>
                                        )}
                                        {item.status === 'waiting' && (
                                            <span className="text-[10px] text-amber-500">Waiting for partner</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}
