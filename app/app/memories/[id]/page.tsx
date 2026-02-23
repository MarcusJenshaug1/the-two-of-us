'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
    ArrowLeft, Heart, MapPin, Tag, Calendar, Trash2, X,
    ChevronLeft, ChevronRight
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'

type Memory = {
    id: string
    room_id: string
    created_by: string
    title: string
    description: string | null
    location: string | null
    tags: string[]
    happened_at: string
    images: string[]
    created_at: string
}

export default function MemoryDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [memory, setMemory] = useState<Memory | null>(null)
    const [isFav, setIsFav] = useState(false)
    const [roomId, setRoomId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [viewerIndex, setViewerIndex] = useState<number | null>(null)

    const supabase = createClient()
    const { user } = useAuth()
    const { toast } = useToast()

    const loadData = useCallback(async () => {
        if (!user || !id) return
        try {
            setIsLoading(true)
            const { data: member } = await supabase
                .from('room_members').select('room_id').eq('user_id', user.id).single()
            if (!member) return
            setRoomId(member.room_id)

            const [memRes, favRes] = await Promise.all([
                supabase.from('memories').select('*').eq('id', id).single(),
                supabase.from('memory_favorites')
                    .select('memory_id')
                    .eq('memory_id', id)
                    .eq('user_id', user.id)
                    .maybeSingle(),
            ])

            setMemory(memRes.data)
            setIsFav(!!favRes.data)
        } catch (err) {
            console.error('Error loading memory', err)
        } finally {
            setIsLoading(false)
        }
    }, [user, id, supabase])

    useEffect(() => { loadData() }, [loadData])

    // Keyboard nav for viewer
    useEffect(() => {
        if (viewerIndex === null || !memory) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setViewerIndex(null)
            if (e.key === 'ArrowLeft') setViewerIndex(i => Math.max(0, (i ?? 0) - 1))
            if (e.key === 'ArrowRight') setViewerIndex(i => Math.min(memory.images.length - 1, (i ?? 0) + 1))
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [viewerIndex, memory])

    async function toggleFav() {
        if (!user || !roomId || !memory) return
        const was = isFav
        setIsFav(!was)
        if (was) {
            await supabase.from('memory_favorites').delete().eq('memory_id', memory.id).eq('user_id', user.id)
        } else {
            await supabase.from('memory_favorites').insert({ memory_id: memory.id, user_id: user.id, room_id: roomId })
        }
    }

    async function handleDelete() {
        if (!memory) return
        const { error } = await supabase.from('memories').delete().eq('id', memory.id)
        if (error) { toast('Failed to delete', 'error'); return }
        toast('Memory deleted', 'success')
        router.push('/app/memories')
    }

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    if (!memory) {
        return (
            <div className="p-4 pt-8 text-center text-zinc-500">
                <p>Memory not found.</p>
                <Link href="/app/memories" className="text-rose-500 text-sm mt-4 inline-block">← Back to memories</Link>
            </div>
        )
    }

    return (
        <div className="pb-24 animate-in fade-in">
            {/* Hero / image album */}
            {memory.images.length > 0 ? (
                <div className="relative">
                    <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                        {memory.images.map((url, i) => (
                            <button
                                key={i}
                                onClick={() => setViewerIndex(i)}
                                className="flex-shrink-0 w-full h-64 sm:h-80 snap-center"
                            >
                                <img src={url} alt={`${memory.title} photo ${i + 1}`} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                    {memory.images.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {memory.images.map((_, i) => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/50" />
                            ))}
                        </div>
                    )}
                    {/* Back button overlay */}
                    <Link
                        href="/app/memories"
                        className="absolute top-4 left-4 p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
                        aria-label="Back to memories"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                </div>
            ) : (
                <div className="p-4 pt-8">
                    <Link href="/app/memories" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4" /> Memories
                    </Link>
                </div>
            )}

            {/* Content */}
            <div className="p-4 space-y-5">
                {/* Title + actions */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                        <h1 className="text-xl font-semibold tracking-tight">{memory.title}</h1>
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(parseISO(memory.happened_at), 'MMMM d, yyyy')}
                            </span>
                            {memory.location && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {memory.location}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={toggleFav}
                            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                            aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            <Heart className={`w-5 h-5 ${isFav ? 'text-rose-500 fill-rose-500' : 'text-zinc-500'}`} />
                        </button>
                        <button
                            onClick={handleDelete}
                            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                            aria-label="Delete memory"
                        >
                            <Trash2 className="w-5 h-5 text-zinc-500" />
                        </button>
                    </div>
                </div>

                {/* Tags */}
                {memory.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                        {memory.tags.map(tag => (
                            <span key={tag} className="flex items-center gap-1 text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 px-2.5 py-1 rounded-full">
                                <Tag className="w-3 h-3" /> {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Description */}
                {memory.description && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{memory.description}</p>
                    </div>
                )}

                {/* Photo grid (if no hero) */}
                {memory.images.length === 0 && (
                    <div className="text-center py-8 text-zinc-600 text-sm">
                        No photos for this memory.
                    </div>
                )}

                {/* Photo grid (below description for quick browse) */}
                {memory.images.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Photos</h3>
                        <div className="grid grid-cols-3 gap-1.5">
                            {memory.images.map((url, i) => (
                                <button
                                    key={i}
                                    onClick={() => setViewerIndex(i)}
                                    className="aspect-square rounded-xl overflow-hidden hover:opacity-80 transition-opacity"
                                >
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ FULLSCREEN VIEWER ═══ */}
            {viewerIndex !== null && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-200"
                    onClick={() => setViewerIndex(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-700 transition-colors z-10"
                        onClick={() => setViewerIndex(null)}
                        aria-label="Close viewer"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Prev / Next */}
                    {viewerIndex > 0 && (
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-700 transition-colors z-10"
                            onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex - 1) }}
                            aria-label="Previous photo"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}
                    {viewerIndex < memory.images.length - 1 && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-700 transition-colors z-10"
                            onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex + 1) }}
                            aria-label="Next photo"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}

                    <img
                        src={memory.images[viewerIndex]}
                        alt=""
                        className="max-h-[85vh] max-w-full rounded-2xl object-contain animate-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Counter */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-zinc-400">
                        {viewerIndex + 1} / {memory.images.length}
                    </div>
                </div>
            )}
        </div>
    )
}
