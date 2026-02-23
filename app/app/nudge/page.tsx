'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useToast } from '@/components/ui/toast'
import { Heart, User, Sparkles } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'

const QUICK_NUDGES = [
    { emoji: '💕', message: 'Thinking of you' },
    { emoji: '🫶', message: 'I love you' },
    { emoji: '😘', message: 'Sending kisses' },
    { emoji: '🤗', message: 'Wish you were here' },
    { emoji: '✨', message: 'You make me happy' },
    { emoji: '🌹', message: 'You are beautiful' },
    { emoji: '💪', message: 'You got this today!' },
    { emoji: '🏠', message: 'Can\'t wait to see you' },
]

type Nudge = {
    id: string
    sender_id: string
    emoji: string
    message: string | null
    seen_at: string | null
    created_at: string
}

export default function NudgePage() {
    const [nudges, setNudges] = useState<Nudge[]>([])
    const [partnerProfile, setPartnerProfile] = useState<any>(null)
    const [roomId, setRoomId] = useState<string | null>(null)
    const [isSending, setIsSending] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const supabase = createClient()
    const { user } = useAuth()
    const { toast } = useToast()

    const loadData = useCallback(async () => {
        if (!user) return
        try {
            const { data: member } = await supabase
                .from('room_members')
                .select('room_id')
                .eq('user_id', user.id)
                .single()

            if (!member) return
            setRoomId(member.room_id)

            // Load partner
            const { data: members } = await supabase
                .from('room_members')
                .select('user_id, profiles(name, avatar_url)')
                .eq('room_id', member.room_id)

            if (members) {
                const partner = members.find((m: any) => m.user_id !== user.id)
                if (partner) {
                    setPartnerProfile(Array.isArray(partner.profiles) ? partner.profiles[0] : partner.profiles)
                }
            }

            // Load recent nudges
            const { data: nudgeData } = await supabase
                .from('nudges')
                .select('*')
                .eq('room_id', member.room_id)
                .order('created_at', { ascending: false })
                .limit(20)

            if (nudgeData) setNudges(nudgeData)

            // Mark unseen nudges from partner as seen
            if (nudgeData) {
                const unseenFromPartner = nudgeData.filter(n => n.sender_id !== user.id && !n.seen_at)
                for (const n of unseenFromPartner) {
                    await supabase.from('nudges').update({ seen_at: new Date().toISOString() }).eq('id', n.id)
                }
            }
        } catch (err) {
            console.error('Error loading nudges', err)
        } finally {
            setIsLoading(false)
        }
    }, [user, supabase])

    useEffect(() => { loadData() }, [loadData])

    // Realtime for new nudges
    useEffect(() => {
        if (!roomId) return

        const channel = supabase
            .channel(`nudges_${roomId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'nudges',
                filter: `room_id=eq.${roomId}`,
            }, (payload: any) => {
                const newNudge = payload.new as Nudge
                setNudges(prev => {
                    if (prev.some(n => n.id === newNudge.id)) return prev
                    return [newNudge, ...prev]
                })
                // Auto-mark as seen if from partner
                if (newNudge.sender_id !== user?.id) {
                    supabase.from('nudges').update({ seen_at: new Date().toISOString() }).eq('id', newNudge.id)
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [roomId, user?.id, supabase])

    const sendNudge = async (emoji: string, message: string) => {
        if (!roomId || !user || isSending) return
        setIsSending(true)

        try {
            const { error } = await supabase
                .from('nudges')
                .insert({
                    room_id: roomId,
                    sender_id: user.id,
                    emoji,
                    message,
                })

            if (error) throw error

            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 2000)
            toast(`${emoji} Sent to ${partnerProfile?.name || 'partner'}!`, 'love')
        } catch (err: any) {
            toast(err.message || 'Failed to send', 'error')
        } finally {
            setIsSending(false)
        }
    }

    const partnerName = partnerProfile?.name || 'Partner'

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    return (
        <div className="p-4 space-y-8 pt-8 md:pt-12 pb-24 animate-in fade-in">
            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-rose-400" />
                    Send Love
                </h1>
                <p className="text-sm text-zinc-400">
                    Let {partnerName} know you&apos;re thinking of them.
                </p>
            </div>

            {/* Success animation */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className="text-7xl animate-in zoom-in fade-in duration-300">💕</div>
                </div>
            )}

            {/* Quick nudge buttons */}
            <div className="grid grid-cols-2 gap-3">
                {QUICK_NUDGES.map(({ emoji, message }) => (
                    <button
                        key={message}
                        onClick={() => sendNudge(emoji, message)}
                        disabled={isSending}
                        className="flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-rose-500/30 hover:bg-rose-500/5 transition-all active:scale-95 disabled:opacity-50 text-left"
                    >
                        <span className="text-2xl">{emoji}</span>
                        <span className="text-sm font-medium text-zinc-300">{message}</span>
                    </button>
                ))}
            </div>

            {/* Recent nudges */}
            {nudges.length > 0 && (
                <div className="space-y-3 pt-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Recent</h3>
                    <div className="space-y-2">
                        {nudges.map(nudge => {
                            const isMe = nudge.sender_id === user?.id
                            return (
                                <div
                                    key={nudge.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                        isMe
                                            ? 'bg-rose-500/5 border-rose-500/10'
                                            : 'bg-zinc-900 border-zinc-800'
                                    }`}
                                >
                                    <span className="text-xl">{nudge.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {isMe ? `You → ${partnerName}` : `${partnerName} → You`}
                                        </p>
                                        <p className="text-xs text-zinc-500 truncate">{nudge.message}</p>
                                    </div>
                                    <span className="text-[10px] text-zinc-600 shrink-0">
                                        {formatDistanceToNow(parseISO(nudge.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
