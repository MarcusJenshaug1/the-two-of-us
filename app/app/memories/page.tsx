'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
    Plus, Heart, Star, MapPin, Tag, Search, X, Camera,
    Trash2, ChevronRight, ImageIcon
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { resizeImage } from '@/lib/storage'
import { SignedImage } from '@/components/signed-image'
import { useTranslations, useLocale } from '@/lib/i18n'
import { getDateLocale } from '@/lib/i18n/date-locale'

type Memory = {
    id: string
    room_id: string
    created_by: string
    title: string
    description: string | null
    location: string | null
    tags: string[]
    happened_at: string
    date_key: string
    images: string[]
    created_at: string
}

type Favorite = { memory_id: string }

export default function MemoriesPage() {
    const [memories, setMemories] = useState<Memory[]>([])
    const [favorites, setFavorites] = useState<Set<string>>(new Set())
    const [roomId, setRoomId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [showFavsOnly, setShowFavsOnly] = useState(false)
    const [selectedTag, setSelectedTag] = useState<string | null>(null)

    // Form
    const [showForm, setShowForm] = useState(false)
    const [formTitle, setFormTitle] = useState('')
    const [formDesc, setFormDesc] = useState('')
    const [formLocation, setFormLocation] = useState('')
    const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [formTags, setFormTags] = useState('')
    const [formImages, setFormImages] = useState<string[]>([])
    const [uploadingImages, setUploadingImages] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const supabase = createClient()
    const { user } = useAuth()
    const { toast } = useToast()
    const t = useTranslations('memories')
    const { locale } = useLocale()
    const dateLoc = getDateLocale(locale)

    const loadData = useCallback(async () => {
        if (!user) return
        try {
            setIsLoading(true)
            const { data: member } = await supabase
                .from('room_members').select('room_id').eq('user_id', user.id).single()
            if (!member) return
            setRoomId(member.room_id)

            const [memRes, favRes] = await Promise.all([
                supabase
                    .from('memories').select('*')
                    .eq('room_id', member.room_id)
                    .order('happened_at', { ascending: false })
                    .limit(200),
                supabase
                    .from('memory_favorites').select('memory_id')
                    .eq('room_id', member.room_id)
                    .eq('user_id', user.id),
            ])

            setMemories(memRes.data || [])
            setFavorites(new Set((favRes.data || []).map((f: Favorite) => f.memory_id)))
        } catch (err) {
            console.error('Error loading memories', err)
        } finally {
            setIsLoading(false)
        }
    }, [user, supabase])

    useEffect(() => { loadData() }, [loadData])

    // ─── Favorite toggle ───
    async function toggleFav(memoryId: string) {
        if (!user || !roomId) return
        const isFav = favorites.has(memoryId)

        // Optimistic
        setFavorites(prev => {
            const next = new Set(prev)
            isFav ? next.delete(memoryId) : next.add(memoryId)
            return next
        })

        if (isFav) {
            await supabase.from('memory_favorites')
                .delete().eq('memory_id', memoryId).eq('user_id', user.id)
        } else {
            await supabase.from('memory_favorites')
                .insert({ memory_id: memoryId, user_id: user.id, room_id: roomId })
        }
    }

    // ─── Image upload ───
    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!user || !e.target.files) return
        const files = Array.from(e.target.files).slice(0, 6 - formImages.length)
        if (files.length === 0) return

        setUploadingImages(true)
        const newPaths: string[] = []
        for (const file of files) {
            try {
                const blob = await resizeImage(file)
                const path = `memories/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
                const { error } = await supabase.storage.from('daily-logs').upload(path, blob, { contentType: 'image/jpeg' })
                if (error) throw error
                newPaths.push(path)
            } catch (err) {
                console.error('Upload failed', err)
            }
        }
        setFormImages(prev => [...prev, ...newPaths])
        setUploadingImages(false)
        if (fileRef.current) fileRef.current.value = ''
    }

    // ─── Save memory ───
    async function handleSave() {
        if (!roomId || !user || !formTitle.trim() || !formDate) return
        setIsSaving(true)
        try {
            const tags = formTags.split(',').map(t => t.trim()).filter(Boolean)
            const { error } = await supabase.from('memories').insert({
                room_id: roomId,
                created_by: user.id,
                title: formTitle.trim(),
                description: formDesc.trim() || null,
                location: formLocation.trim() || null,
                tags,
                happened_at: formDate,
                date_key: formDate,
                images: formImages,
            })
            if (error) throw error
            toast(t('memorySaved'), 'love')
            resetForm()
            loadData()
        } catch (err: any) {
            toast(err.message || t('failedToSave'), 'error')
        } finally {
            setIsSaving(false)
        }
    }

    function resetForm() {
        setShowForm(false)
        setFormTitle('')
        setFormDesc('')
        setFormLocation('')
        setFormDate(format(new Date(), 'yyyy-MM-dd'))
        setFormTags('')
        setFormImages([])
    }

    // ─── Delete memory ───
    async function handleDelete(id: string) {
        const { error } = await supabase.from('memories').delete().eq('id', id)
        if (error) { toast(t('failedToDelete'), 'error'); return }
        toast(t('memoryDeleted'), 'success')
        loadData()
    }

    // ─── Derived data ───
    const allTags = Array.from(new Set(memories.flatMap(m => m.tags))).sort()

    const filtered = memories.filter(m => {
        if (showFavsOnly && !favorites.has(m.id)) return false
        if (selectedTag && !m.tags.includes(selectedTag)) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            return m.title.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)
        }
        return true
    })

    // ─── Render ───
    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    return (
        <div className="p-4 space-y-6 pt-8 md:pt-12 pb-24 animate-in fade-in">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
                <p className="text-sm text-zinc-400">{t('subtitle')}</p>
            </div>

            {/* Actions */}
            <Button
                onClick={() => { resetForm(); setShowForm(true) }}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white"
            >
                <Plus className="w-4 h-4 mr-2" /> {t('addMemory')}
            </Button>

            {/* Filters */}
            <div className="space-y-3">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder={t('searchPlaceholder')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="w-4 h-4 text-zinc-500" />
                        </button>
                    )}
                </div>

                {/* Filter pills */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setShowFavsOnly(!showFavsOnly)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            showFavsOnly ? 'bg-rose-600 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                        }`}
                    >
                        <Heart className="w-3 h-3" fill={showFavsOnly ? 'currentColor' : 'none'} /> {t('favorites')}
                    </button>
                    {allTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                selectedTag === tag ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}
                        >
                            <Tag className="w-3 h-3" /> {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* Memory list */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                    <Star className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
                    {memories.length === 0 ? t('noMemoriesYet') : t('noMatches')}
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(mem => (
                        <Link
                            key={mem.id}
                            href={`/app/memories/${mem.id}`}
                            className="block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-zinc-700 transition-colors"
                        >
                            {/* Thumbnail strip */}
                            {mem.images.length > 0 && (
                                <div className="flex h-28 overflow-hidden">
                                    {mem.images.slice(0, 3).map((url, i) => (
                                        <div key={i} className="flex-1 min-w-0 relative">
                                            <SignedImage path={url} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                    {mem.images.length > 3 && (
                                        <div className="absolute right-2 bottom-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md">
                                            +{mem.images.length - 3}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="p-4 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <p className="font-medium text-sm leading-snug">{mem.title}</p>
                                        <p className="text-xs text-zinc-500">
                                            {format(parseISO(mem.happened_at), 'MMM d, yyyy', { locale: dateLoc })}
                                            {mem.location && <> · <MapPin className="w-3 h-3 inline -mt-0.5" /> {mem.location}</>}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(mem.id) }}
                                            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                                            aria-label={favorites.has(mem.id) ? t('removeFromFavorites') : t('addToFavorites')}
                                        >
                                            <Heart
                                                className={`w-4 h-4 transition-colors ${favorites.has(mem.id) ? 'text-rose-500 fill-rose-500' : 'text-zinc-600'}`}
                                            />
                                        </button>
                                        <ChevronRight className="w-4 h-4 text-zinc-700" />
                                    </div>
                                </div>
                                {mem.tags.length > 0 && (
                                    <div className="flex gap-1 flex-wrap">
                                        {mem.tags.map(tag => (
                                            <span key={tag} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* ═══ ADD MEMORY MODAL ═══ */}
            {showForm && (
                <div
                    className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={resetForm}
                >
                    <div
                        className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{t('newMemory')}</h3>
                            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors" aria-label="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder={`${t('formTitle')} *`}
                                value={formTitle}
                                onChange={e => setFormTitle(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
                                maxLength={120}
                                autoFocus
                            />
                            <textarea
                                placeholder={t('formDescriptionPlaceholder')}
                                value={formDesc}
                                onChange={e => setFormDesc(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600 resize-none min-h-[80px]"
                                maxLength={1000}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">{t('formDate')} *</label>
                                    <input
                                        type="date"
                                        value={formDate}
                                        onChange={e => setFormDate(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1 block">{t('formLocation')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('formLocationPlaceholder')}
                                        value={formLocation}
                                        onChange={e => setFormLocation(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
                                        maxLength={120}
                                    />
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder={t('formTagsPlaceholder')}
                                value={formTags}
                                onChange={e => setFormTags(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 placeholder:text-zinc-600"
                            />

                            {/* Image upload */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fileRef.current?.click()}
                                        disabled={formImages.length >= 6 || uploadingImages}
                                        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-medium text-zinc-300 transition-colors disabled:opacity-40"
                                    >
                                        <Camera className="w-4 h-4" />
                                        {uploadingImages ? t('uploading') : `${t('addPhotos')} (${formImages.length}/6)`}
                                    </button>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        multiple
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                </div>
                                {formImages.length > 0 && (
                                    <div className="flex gap-2 flex-wrap">
                                        {formImages.map((url, i) => (
                                            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                                                <SignedImage path={url} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => setFormImages(prev => prev.filter((_, j) => j !== i))}
                                                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                                                    aria-label={t('removePhoto')}
                                                >
                                                    <X className="w-3 h-3 text-white" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={!formTitle.trim() || !formDate || isSaving}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            {isSaving ? t('saving') : t('saveMemory')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
