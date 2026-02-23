'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useToast } from '@/components/ui/toast'
import { Sparkles, Camera, X, Send, User, ImagePlus, Pencil, Check } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { resizeImage } from '@/lib/storage'
import { SignedImage, useSignedUrl } from '@/components/signed-image'

const TIMEZONE = 'Europe/Oslo'

function getDateKey() {
    const now = new Date()
    const osloHour = parseInt(formatInTimeZone(now, TIMEZONE, 'HH'), 10)
    const businessDate = osloHour < 6 ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : now
    return formatInTimeZone(businessDate, TIMEZONE, 'yyyy-MM-dd')
}

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

type DailyLog = {
    id: string
    user_id: string
    text: string | null
    images: string[]
    date_key: string
    created_at: string
}

export default function LovePage() {
    // Nudge state
    const [nudges, setNudges] = useState<Nudge[]>([])
    const [isSending, setIsSending] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)

    // Daily log state
    const [myLog, setMyLog] = useState<DailyLog | null>(null)
    const [partnerLog, setPartnerLog] = useState<DailyLog | null>(null)
    const [logText, setLogText] = useState('')
    const [logImages, setLogImages] = useState<string[]>([])
    const [isEditingLog, setIsEditingLog] = useState(false)
    const [isSavingLog, setIsSavingLog] = useState(false)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    // Shared state
    const [partnerProfile, setPartnerProfile] = useState<any>(null)
    const [myProfile, setMyProfile] = useState<any>(null)
    const [roomId, setRoomId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const imageInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()
    const { user } = useAuth()
    const { toast } = useToast()
    const dateKey = getDateKey()

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

            // Load profiles
            const { data: members } = await supabase
                .from('room_members')
                .select('user_id, profiles(name, avatar_url)')
                .eq('room_id', member.room_id)

            if (members) {
                for (const m of members as any[]) {
                    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                    if (m.user_id === user.id) setMyProfile(profile)
                    else setPartnerProfile(profile)
                }
            }

            // Load recent nudges
            const { data: nudgeData } = await supabase
                .from('nudges')
                .select('*')
                .eq('room_id', member.room_id)
                .order('created_at', { ascending: false })
                .limit(10)

            if (nudgeData) {
                setNudges(nudgeData)
                const unseen = nudgeData.filter(n => n.sender_id !== user.id && !n.seen_at)
                for (const n of unseen) {
                    await supabase.from('nudges').update({ seen_at: new Date().toISOString() }).eq('id', n.id)
                }
            }

            // Load today's daily logs
            const { data: logData } = await supabase
                .from('daily_logs')
                .select('*')
                .eq('room_id', member.room_id)
                .eq('date_key', dateKey)

            if (logData) {
                const mine = logData.find((l: any) => l.user_id === user.id) as DailyLog | undefined
                const theirs = logData.find((l: any) => l.user_id !== user.id) as DailyLog | undefined
                if (mine) {
                    setMyLog(mine)
                    setLogText(mine.text || '')
                    setLogImages(mine.images || [])
                }
                if (theirs) setPartnerLog(theirs)
            }
        } catch (err) {
            console.error('Error loading data', err)
        } finally {
            setIsLoading(false)
        }
    }, [user, supabase, dateKey])

    useEffect(() => { loadData() }, [loadData])

    // Realtime for nudges
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
                if (newNudge.sender_id !== user?.id) {
                    supabase.from('nudges').update({ seen_at: new Date().toISOString() }).eq('id', newNudge.id)
                    toast(`${newNudge.emoji} ${partnerProfile?.name || 'Partner'}: ${newNudge.message}`, 'love')
                }
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [roomId, user?.id, supabase, partnerProfile?.name, toast])

    // === Nudge ===
    const sendNudge = async (emoji: string, message: string) => {
        if (!roomId || !user || isSending) return
        setIsSending(true)
        try {
            const { error } = await supabase.from('nudges').insert({
                room_id: roomId, sender_id: user.id, emoji, message,
            })
            if (error) throw error
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 2000)
            toast(`${emoji} Sent!`, 'love')
        } catch (err: any) {
            toast(err.message || 'Failed to send', 'error')
        } finally {
            setIsSending(false)
        }
    }

    // === Daily Log ===
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || !user || !roomId) return
        if (logImages.length + files.length > 6) {
            toast('Maximum 6 photos per day', 'error')
            return
        }
        setIsUploadingImage(true)
        try {
            const newPaths: string[] = []
            for (const file of Array.from(files)) {
                const resized = await resizeImage(file)
                const filename = `${user.id}/${dateKey}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`
                const { error: uploadErr } = await supabase.storage
                    .from('daily-logs')
                    .upload(filename, resized, { contentType: 'image/jpeg', upsert: false })
                if (uploadErr) throw uploadErr
                newPaths.push(filename)
            }
            setLogImages(prev => [...prev, ...newPaths])
            toast(`${newPaths.length} photo${newPaths.length > 1 ? 's' : ''} added 📸`, 'success')
        } catch (err: any) {
            toast(err.message || 'Failed to upload image', 'error')
        } finally {
            setIsUploadingImage(false)
            if (imageInputRef.current) imageInputRef.current.value = ''
        }
    }

    const removeImage = (index: number) => {
        setLogImages(prev => prev.filter((_, i) => i !== index))
    }

    const saveLog = async () => {
        if (!user || !roomId) return
        if (!logText.trim() && logImages.length === 0) {
            toast('Write something or add a photo!', 'info')
            return
        }
        setIsSavingLog(true)
        try {
            const payload = {
                room_id: roomId,
                user_id: user.id,
                text: logText.trim() || null,
                images: logImages,
                date_key: dateKey,
            }

            if (myLog) {
                const { error } = await supabase
                    .from('daily_logs')
                    .update({ text: payload.text, images: payload.images, updated_at: new Date().toISOString() })
                    .eq('id', myLog.id)
                if (error) throw error
                setMyLog({ ...myLog, ...payload })
            } else {
                const { data, error } = await supabase
                    .from('daily_logs')
                    .insert(payload)
                    .select()
                    .single()
                if (error) throw error
                setMyLog(data)
            }
            setIsEditingLog(false)
            toast('Saved! Your partner can see it now 💕', 'love')
        } catch (err: any) {
            toast(err.message || 'Failed to save', 'error')
        } finally {
            setIsSavingLog(false)
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

    const hasExistingLog = myLog && (myLog.text || (myLog.images && myLog.images.length > 0))

    return (
        <div className="p-4 space-y-8 pt-8 md:pt-12 pb-24 animate-in fade-in">
            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-rose-400" />
                    Love
                </h1>
                <p className="text-sm text-zinc-400">
                    Stay connected with {partnerName} throughout the day.
                </p>
            </div>

            {/* Success animation */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className="text-7xl animate-in zoom-in fade-in duration-300">💕</div>
                </div>
            )}

            {/* ===== TODAY'S JOURNAL ===== */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <Camera className="w-3.5 h-3.5" /> Today&apos;s Journal
                    </h3>
                    <span className="text-[10px] text-zinc-600">{formatInTimeZone(new Date(), TIMEZONE, 'EEEE, MMM d')}</span>
                </div>

                {/* My log */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center">
                                {myProfile?.avatar_url ? (
                                    <img src={myProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-3 w-3 text-zinc-500" />
                                )}
                            </div>
                            <span className="text-xs font-semibold text-rose-400">You</span>
                        </div>
                        {hasExistingLog && !isEditingLog && (
                            <button
                                onClick={() => setIsEditingLog(true)}
                                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                            >
                                <Pencil className="w-3 h-3" /> Edit
                            </button>
                        )}
                    </div>

                    {hasExistingLog && !isEditingLog ? (
                        <div className="px-4 pb-4 space-y-3">
                            {myLog.text && (
                                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{myLog.text}</p>
                            )}
                            {myLog.images && myLog.images.length > 0 && (
                                <div className={`grid gap-1.5 ${myLog.images.length === 1 ? 'grid-cols-1' : myLog.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                    {myLog.images.map((url, i) => (
                                        <button key={i} onClick={() => setPreviewImage(url)} className="aspect-square rounded-xl overflow-hidden bg-zinc-800">
                                            <SignedImage path={url} alt="" className="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="px-4 pb-4 space-y-3">
                            <textarea
                                className="w-full min-h-[80px] resize-none bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600 transition-all"
                                placeholder="What did you do today? ✨"
                                value={logText}
                                onChange={(e) => setLogText(e.target.value)}
                                maxLength={1000}
                                disabled={isSavingLog}
                            />

                            <div className="flex flex-wrap gap-2">
                                {logImages.map((url, i) => (
                                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-800 group">
                                        <SignedImage path={url} alt="" className="h-full w-full object-cover" />
                                        <button
                                            onClick={() => removeImage(i)}
                                            className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3 text-white" />
                                        </button>
                                    </div>
                                ))}

                                {logImages.length < 6 && (
                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        disabled={isUploadingImage}
                                        className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-700 hover:border-rose-500/30 flex flex-col items-center justify-center gap-1 transition-colors"
                                    >
                                        {isUploadingImage ? (
                                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
                                        ) : (
                                            <>
                                                <ImagePlus className="w-4 h-4 text-zinc-500" />
                                                <span className="text-[10px] text-zinc-600">{logImages.length}/6</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleImageUpload}
                            />

                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={saveLog}
                                    disabled={isSavingLog || (!logText.trim() && logImages.length === 0)}
                                    className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white text-sm"
                                >
                                    {isSavingLog ? 'Saving...' : (
                                        <span className="flex items-center gap-2">
                                            <Check className="w-4 h-4" /> Save
                                        </span>
                                    )}
                                </Button>
                                {isEditingLog && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsEditingLog(false)
                                            setLogText(myLog?.text || '')
                                            setLogImages(myLog?.images || [])
                                        }}
                                        className="h-10 text-sm"
                                    >
                                        Cancel
                                    </Button>
                                )}
                            </div>
                            <p className="text-[10px] text-zinc-600 text-center">{logText.length}/1000 · Max 6 photos</p>
                        </div>
                    )}
                </div>

                {/* Partner's log */}
                {partnerLog && (partnerLog.text || (partnerLog.images && partnerLog.images.length > 0)) && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                            <div className="h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center">
                                {partnerProfile?.avatar_url ? (
                                    <img src={partnerProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-3 w-3 text-zinc-500" />
                                )}
                            </div>
                            <span className="text-xs font-semibold text-zinc-400">{partnerName}</span>
                        </div>
                        <div className="px-4 pb-4 space-y-3">
                            {partnerLog.text && (
                                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{partnerLog.text}</p>
                            )}
                            {partnerLog.images && partnerLog.images.length > 0 && (
                                <div className={`grid gap-1.5 ${partnerLog.images.length === 1 ? 'grid-cols-1' : partnerLog.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                    {partnerLog.images.map((url, i) => (
                                        <button key={i} onClick={() => setPreviewImage(url)} className="aspect-square rounded-xl overflow-hidden bg-zinc-800">
                                            <SignedImage path={url} alt="" className="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!partnerLog && (
                    <div className="text-center py-3 text-xs text-zinc-600">
                        {partnerName} hasn&apos;t shared their day yet
                    </div>
                )}
            </div>

            {/* ===== QUICK NUDGES ===== */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" /> Quick Love
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                    {QUICK_NUDGES.map(({ emoji, message }) => (
                        <button
                            key={message}
                            onClick={() => sendNudge(emoji, message)}
                            disabled={isSending}
                            className="flex items-center gap-3 p-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-rose-500/30 hover:bg-rose-500/5 transition-all active:scale-95 disabled:opacity-50 text-left"
                        >
                            <span className="text-xl">{emoji}</span>
                            <span className="text-sm font-medium text-zinc-300">{message}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Recent nudges */}
            {nudges.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Recent</h3>
                    <div className="space-y-2">
                        {nudges.map(nudge => {
                            const isMe = nudge.sender_id === user?.id
                            return (
                                <div
                                    key={nudge.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                        isMe ? 'bg-rose-500/5 border-rose-500/10' : 'bg-zinc-900 border-zinc-800'
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

            {/* Fullscreen image preview */}
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
