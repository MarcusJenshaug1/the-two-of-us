'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, CircleDashed } from 'lucide-react'

// Inbox List View
export default function InboxPage() {
    const [history, setHistory] = useState<any[]>([])
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
            questions(text), 
            answers(user_id)
          `)
                    .eq('room_id', member.room_id)
                    .order('date_key', { ascending: false })
                    .limit(30) // Last 30 days for list

                if (!mounted || !dqData) return

                // Process data
                const processed = dqData.map((item: any) => {
                    const myAnswer = item.answers.find((a: any) => a.user_id === user.id)
                    const theirAnswer = item.answers.find((a: any) => a.user_id !== user.id)
                    const status = (myAnswer && theirAnswer) ? 'completed'
                        : (myAnswer || theirAnswer) ? 'waiting'
                            : 'missed'

                    return {
                        id: item.id,
                        date_key: item.date_key,
                        text: item.questions?.text || 'Unknown question',
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
    }, [user, supabase])

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    return (
        <div className="p-4 space-y-6 pt-8 md:pt-12">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
                <p className="text-sm text-zinc-400">Past questions and answers.</p>
            </div>

            <div className="space-y-3">
                {history.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 text-sm border border-zinc-800 border-dashed rounded-xl">
                        No history yet. Start answering daily questions!
                    </div>
                ) : (
                    history.map((item) => (
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
                                    <p className="text-xs text-zinc-500">
                                        {format(parseISO(item.date_key), 'MMM d, yyyy')}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}
