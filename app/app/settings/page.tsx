'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogOut, User, Users, Heart, Download, Share, PlusSquare, CheckCircle2, Camera, Bell, BellOff, BellRing, Globe } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import { useToast } from '@/components/ui/toast'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { IosInstallGuideSheet } from '@/components/pwa/IosInstallGuideSheet'
import { useLocale, useTranslations } from '@/lib/i18n'

// Resize image before upload (max 400x400)
function resizeImage(file: File, maxSize = 400): Promise<Blob> {
    return new Promise((resolve) => {
        const img = new Image()
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        img.onload = () => {
            let w = img.width
            let h = img.height
            if (w > h) {
                if (w > maxSize) { h = h * maxSize / w; w = maxSize }
            } else {
                if (h > maxSize) { w = w * maxSize / h; h = maxSize }
            }
            canvas.width = w
            canvas.height = h
            ctx.drawImage(img, 0, 0, w, h)
            canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85)
        }
        img.src = URL.createObjectURL(file)
    })
}

// Settings 
export default function SettingsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [room, setRoom] = useState<any>(null)
    const [partner, setPartner] = useState<any>(null)
    const [memberCount, setMemberCount] = useState(0)
    const [name, setName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [anniversary, setAnniversary] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const { status: notifStatus, subscribe: subscribeNotifs, unsubscribe: unsubscribeNotifs, isSubscribing } = useNotifications()

    // PWA install hook
    const pwaInstall = usePwaInstall()

    const supabase = createClient()
    const { user, signOut } = useAuth()
    const router = useRouter()
    const { toast } = useToast()
    const t = useTranslations('settings')
    const { locale, setLocale } = useLocale()

    useEffect(() => {
        if (!user) return
        let mounted = true

        const loadSettings = async () => {
            // 1. Get profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (profileData && mounted) {
                setProfile(profileData)
                setName(profileData.name || '')
                setAvatarUrl(profileData.avatar_url || null)
            }

            // 2. Get room
            const { data: member } = await supabase
                .from('room_members')
                .select('room_id, rooms(*)')
                .eq('user_id', user.id)
                .single()

            if (member && member.rooms && mounted) {
                const r = Array.isArray(member.rooms) ? member.rooms[0] : member.rooms
                setRoom(r)
                if (r.anniversary_date) {
                    setAnniversary(r.anniversary_date)
                }

                // 3. Get all room members with profiles
                const { data: members } = await supabase
                    .from('room_members')
                    .select('user_id, profiles(id, name, avatar_url)')
                    .eq('room_id', r.id)

                if (members && mounted) {
                    setMemberCount(members.length)
                    const partnerMember = members.find((m: any) => m.user_id !== user.id)
                    if (partnerMember) {
                        const p = Array.isArray(partnerMember.profiles)
                            ? partnerMember.profiles[0]
                            : partnerMember.profiles
                        setPartner(p)
                    }
                }
            }
        }

        loadSettings()
        return () => { mounted = false }
    }, [user, supabase])

    const handleSaveProfile = async () => {
        if (!user) return
        setIsSaving(true)
        try {
            await supabase.from('profiles').update({ name }).eq('id', user.id)
            setProfile((p: any) => ({ ...p, name }))
        } catch (err) {
            console.error(err)
            toast(t('profileFailed'), 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !user) return

        setIsUploadingAvatar(true)
        try {
            // Resize image client-side
            const resized = await resizeImage(file)
            const filePath = `${user.id}/avatar.jpg`

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, resized, {
                    contentType: 'image/jpeg',
                    upsert: true,
                })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            // Add cache buster
            const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`

            // Update profile
            await supabase.from('profiles')
                .update({ avatar_url: urlWithCacheBust })
                .eq('id', user.id)

            setAvatarUrl(urlWithCacheBust)
            setProfile((p: any) => ({ ...p, avatar_url: urlWithCacheBust }))
        } catch (err: any) {
            console.error(err)
            toast(err.message || t('avatarFailed'), 'error')
        } finally {
            setIsUploadingAvatar(false)
        }
    }

    const handleSaveRoom = async () => {
        if (!room) return
        setIsSaving(true)
        try {
            await supabase.from('rooms').update({ anniversary_date: anniversary }).eq('id', room.id)

            // Log to audit
            await supabase.from('audit').insert({
                room_id: room.id,
                user_id: user?.id,
                action: 'set_anniversary'
            })
            toast(t('relationshipUpdated'), 'success')
        } catch (err) {
            console.error(err)
            toast(t('relationshipFailed'), 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const handleInstallClick = async () => {
        if (pwaInstall.platform === 'ios') {
            pwaInstall.openIosGuide()
            return
        }

        const result = await pwaInstall.promptInstall()
        if (result === 'unavailable') {
            toast(t('browserNoAutoInstall'), 'info')
        } else if (result === 'accepted') {
            toast(t('appInstalling'), 'success')
        }
    }

    const handleLogout = async () => {
        await signOut()
        router.push('/sign-in')
    }

    return (
        <div className="p-4 space-y-8 pt-8 md:pt-12 pb-24 max-w-lg mx-auto">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
                <p className="text-sm text-zinc-400">{t('subtitle')}</p>
            </div>

            {/* Profile Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 flex items-center">
                    <User className="w-4 h-4 mr-2" /> {t('profile')}
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                    {/* Avatar */}
                    <div className="flex items-center space-x-4">
                        <button
                            type="button"
                            className="relative group shrink-0"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                        >
                            <div className="h-16 w-16 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden flex items-center justify-center">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-7 w-7 text-zinc-500" />
                                )}
                            </div>
                            <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Camera className="h-5 w-5 text-white" />
                            </div>
                            {isUploadingAvatar && (
                                <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                </div>
                            )}
                        </button>
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarUpload}
                        />
                        <div className="space-y-0.5">
                            <p className="font-medium text-sm">{profile?.name || t('noName')}</p>
                            <p className="text-xs text-zinc-500">{user?.email}</p>
                            <p className="text-[10px] text-zinc-600">{t('tapPhoto')}</p>
                        </div>
                    </div>

                    {/* Name */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                        <label className="text-sm font-medium">{t('displayName')}</label>
                        <div className="flex space-x-2">
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="flex-1"
                            />
                            <Button onClick={handleSaveProfile} disabled={isSaving || name === profile?.name}>
                                {t('save')}
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Relationship Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 flex items-center">
                    <Heart className="w-4 h-4 mr-2" /> {t('relationship')}
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                    {/* Partner or Invite */}
                    {memberCount >= 2 && partner ? (
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center">
                                <Users className="w-4 h-4 mr-2 text-zinc-400" /> {t('yourPartner')}
                            </label>
                            <div className="flex items-center space-x-3 bg-zinc-950 p-3 rounded-xl border border-zinc-800/50">
                                <div className="h-10 w-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                                    {partner.avatar_url ? (
                                        <img src={partner.avatar_url} alt={partner.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-5 w-5 text-zinc-500" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{partner.name || t('noName')}</p>
                                    <p className="text-[10px] text-zinc-500">{t('partnerConnected')}</p>
                                </div>
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto shrink-0" />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center">
                                <Users className="w-4 h-4 mr-2 text-zinc-400" /> {t('inviteYourPartner')}
                            </label>
                            {room ? (
                                <div className="flex space-x-2">
                                    <Input
                                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${room?.invite_code}`}
                                        readOnly
                                        className="bg-zinc-950 font-mono text-xs"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/invite/${room?.invite_code}`)
                                            toast(t('copiedClipboard'), 'success')
                                        }}
                                    >
                                        {t('copyBtn')}
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-sm text-zinc-500">{t('notInRoomYet')}</p>
                            )}
                            <p className="text-xs text-zinc-500">
                                {t('shareThisLink')}
                            </p>
                        </div>
                    )}

                    {/* Anniversary */}
                    <div className="pt-4 border-t border-zinc-800 space-y-2">
                        <label className="text-sm font-medium">{t('anniversaryDate')}</label>
                        <div className="flex space-x-2">
                            <Input
                                type="date"
                                value={anniversary}
                                onChange={(e) => setAnniversary(e.target.value)}
                                className="flex-1"
                            />
                            <Button onClick={handleSaveRoom} disabled={isSaving || anniversary === room?.anniversary_date}>
                                {t('save')}
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* App Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 flex items-center">
                    <Download className="w-4 h-4 mr-2" /> {t('app')}
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                    {pwaInstall.isInstalled ? (
                        /* Already installed */
                        <div className="flex items-center space-x-3 text-emerald-400">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="font-medium text-sm">{t('appInstalled')}</p>
                                <p className="text-xs text-zinc-500">{t('appInstalledDesc')}</p>
                            </div>
                        </div>
                    ) : pwaInstall.isInstallable && pwaInstall.platform === 'ios' ? (
                        /* iOS guide button */
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="font-medium text-sm">{t('installOnIphone')}</p>
                                <p className="text-xs text-zinc-400">{t('installOnIphoneDesc')}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleInstallClick}>
                                {t('install')}
                            </Button>
                        </div>
                    ) : pwaInstall.isInstallable && pwaInstall.platform === 'supported' ? (
                        /* Android / Desktop – native install prompt */
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="font-medium text-sm">{t('installApp')}</p>
                                <p className="text-xs text-zinc-400">{t('installAppDesc')}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleInstallClick}>
                                {t('install')}
                            </Button>
                        </div>
                    ) : null}
                </div>
            </section>

            {/* iOS Install Guide Sheet */}
            <IosInstallGuideSheet
                isOpen={pwaInstall.iosGuideOpen}
                onClose={pwaInstall.closeIosGuide}
            />

            {/* Notifications Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 flex items-center">
                    <Bell className="w-4 h-4 mr-2" /> {t('notifications')}
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    {notifStatus === 'unsupported' ? (
                        <div className="flex items-center space-x-3 text-zinc-500">
                            <BellOff className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="font-medium text-sm">{t('notifsNotAvailable')}</p>
                                <p className="text-xs text-zinc-500">{t('notifsNotAvailableDesc')}</p>
                            </div>
                        </div>
                    ) : notifStatus === 'denied' ? (
                        <div className="flex items-center space-x-3 text-amber-400">
                            <BellOff className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="font-medium text-sm">{t('notifsBlocked')}</p>
                                <p className="text-xs text-zinc-400">{t('notifsBlockedDesc')}</p>
                            </div>
                        </div>
                    ) : notifStatus === 'subscribed' ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 text-emerald-400">
                                <BellRing className="w-5 h-5 shrink-0" />
                                <div>
                                    <p className="font-medium text-sm">{t('notifsOn')}</p>
                                    <p className="text-xs text-zinc-400">{t('notifsOnDesc')}</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={unsubscribeNotifs}>
                                {t('turnOff')}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="font-medium text-sm">{t('enableNotifications')}</p>
                                <p className="text-xs text-zinc-400">{t('enableNotifsDesc')}</p>
                            </div>
                            <Button
                                size="sm"
                                className="bg-rose-600 hover:bg-rose-700 text-white"
                                onClick={async () => {
                                    const result = await subscribeNotifs()
                                    if (!result.ok) {
                                        if (result.reason === 'permission-denied') {
                                            toast(t('notifsBlocked'), 'error')
                                        } else if (result.reason?.includes('Service worker')) {
                                            toast(t('notifsSWError'), 'error')
                                        } else {
                                            toast(t('notifsFailedActivate'), 'error')
                                        }
                                    }
                                }}
                                disabled={isSubscribing || notifStatus === 'loading'}
                            >
                                {isSubscribing ? t('enabling') : t('enable')}
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            {/* Language Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 flex items-center">
                    <Globe className="w-4 h-4 mr-2" /> {t('language')}
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <p className="text-xs text-zinc-400">{t('languageDesc')}</p>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setLocale('en')}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors border ${
                                locale === 'en'
                                    ? 'bg-white text-black border-white'
                                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                            }`}
                        >
                            {t('english')}
                        </button>
                        <button
                            onClick={() => setLocale('no')}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors border ${
                                locale === 'no'
                                    ? 'bg-white text-black border-white'
                                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                            }`}
                        >
                            {t('norwegian')}
                        </button>
                    </div>
                </div>
            </section>

            {/* Version */}
            <div className="text-center text-xs text-zinc-600 pt-4">
                <p>v {process.env.NEXT_PUBLIC_APP_VERSION || 'dev'}</p>
            </div>

            <section className="pt-8">
                <Button
                    variant="destructive"
                    className="w-full h-12 flex items-center justify-center space-x-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors"
                    onClick={handleLogout}
                >
                    <LogOut className="w-5 h-5" />
                    <span>{t('signOut')}</span>
                </Button>
            </section>
        </div>
    )
}
