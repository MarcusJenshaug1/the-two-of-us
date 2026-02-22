'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogOut, User, Users, Heart, Download, Share, PlusSquare, MoreVertical, CheckCircle2 } from 'lucide-react'

// Settings 
export default function SettingsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [room, setRoom] = useState<any>(null)
    const [name, setName] = useState('')
    const [anniversary, setAnniversary] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [installPrompt, setInstallPrompt] = useState<any>(null)
    const [isIOS, setIsIOS] = useState(false)
    const [isStandalone, setIsStandalone] = useState(false)

    const supabase = createClient()
    const { user, signOut } = useAuth()
    const router = useRouter()

    useEffect(() => {
        // Detect iOS
        const ua = navigator.userAgent
        const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        setIsIOS(ios)

        // Detect if already installed (standalone mode)
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (navigator as any).standalone === true
        setIsStandalone(standalone)

        // PWA Install Prompt listening (Android/Desktop only)
        const handler = (e: Event) => {
            e.preventDefault()
            setInstallPrompt(e)
        }
        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

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
            alert('Profile updated')
        } catch (err) {
            console.error(err)
            alert('Failed to update profile')
        } finally {
            setIsSaving(false)
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
            alert('Relationship details updated')
        } catch (err) {
            console.error(err)
            alert('Failed to update relationship details')
        } finally {
            setIsSaving(false)
        }
    }

    const handleInstallClick = () => {
        if (!installPrompt) {
            alert("App is already installed or your browser doesn't support automatic installation. You can usually install it from your browser's share or settings menu (e.g. 'Add to Home Screen' on Safari/iOS).")
            return
        }
        installPrompt.prompt()
        installPrompt.userChoice.then((choiceResult: any) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt')
            }
            setInstallPrompt(null)
        })
    }

    const handleLogout = async () => {
        await signOut()
        router.push('/sign-in')
    }

    return (
        <div className="p-4 space-y-8 pt-8 md:pt-12 pb-24 max-w-lg mx-auto">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
                <p className="text-sm text-zinc-400">Manage your account and preferences.</p>
            </div>

            {/* Profile Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 flex items-center">
                    <User className="w-4 h-4 mr-2" /> Profile
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Display Name</label>
                        <div className="flex space-x-2">
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="flex-1"
                            />
                            <Button onClick={handleSaveProfile} disabled={isSaving || name === profile?.name}>
                                Save
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Email</label>
                        <p className="text-sm text-zinc-400">{user?.email}</p>
                    </div>
                </div>
            </section>

            {/* Relationship Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 flex items-center">
                    <Heart className="w-4 h-4 mr-2" /> Relationship
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Anniversary Date</label>
                        <div className="flex space-x-2">
                            <Input
                                type="date"
                                value={anniversary}
                                onChange={(e) => setAnniversary(e.target.value)}
                                className="flex-1"
                            />
                            <Button onClick={handleSaveRoom} disabled={isSaving || anniversary === room?.anniversary_date}>
                                Save
                            </Button>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-800 space-y-2">
                        <label className="text-sm font-medium flex items-center">
                            <Users className="w-4 h-4 mr-2 text-zinc-400" /> Share Invite Link
                        </label>
                        {room ? (
                            <div className="flex space-x-2">
                                <Input
                                    value={`${window.location.origin}/invite/${room?.invite_code}`}
                                    readOnly
                                    className="bg-zinc-950 font-mono text-xs"
                                />
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/invite/${room?.invite_code}`)
                                        alert('Copied to clipboard!')
                                    }}
                                >
                                    Copy
                                </Button>
                            </div>
                        ) : (
                            <p className="text-sm text-zinc-500">Not in a room yet.</p>
                        )}
                        <p className="text-xs text-zinc-500">
                            Only share this with your single partner. Rooms are strictly limited to 2 people.
                        </p>
                    </div>
                </div>
            </section>

            {/* App Section */}
            <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 flex items-center">
                    <Download className="w-4 h-4 mr-2" /> App
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                    {isStandalone ? (
                        /* Already installed */
                        <div className="flex items-center space-x-3 text-emerald-400">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="font-medium text-sm">App Installed</p>
                                <p className="text-xs text-zinc-500">You&apos;re using the app from your home screen.</p>
                            </div>
                        </div>
                    ) : isIOS ? (
                        /* iOS guide */
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <p className="font-medium text-sm">Install on iPhone</p>
                                <p className="text-xs text-zinc-400">Follow these steps to add the app to your home screen.</p>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-start space-x-3">
                                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold">1</div>
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">Tap the Share button</p>
                                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                                            Tap <Share className="inline h-3.5 w-3.5 text-blue-400" /> at the bottom of Safari.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold">2</div>
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">Add to Home Screen</p>
                                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                                            Scroll down and tap <PlusSquare className="inline h-3.5 w-3.5 text-zinc-300" /> <span className="text-zinc-300 font-medium">Add to Home Screen</span>.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold">3</div>
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">Tap Add</p>
                                        <p className="text-xs text-zinc-500">Confirm by tapping <span className="text-zinc-300 font-medium">Add</span> in the top right corner.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Android / Desktop – native install prompt */
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="font-medium text-sm">Install App</p>
                                <p className="text-xs text-zinc-400">Add to your home screen for quick access.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleInstallClick}>
                                Install
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            <section className="pt-8">
                <Button
                    variant="destructive"
                    className="w-full h-12 flex items-center justify-center space-x-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors"
                    onClick={handleLogout}
                >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                </Button>
            </section>
        </div>
    )
}
