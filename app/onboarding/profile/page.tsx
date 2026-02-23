'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/supabase/auth-provider'
import { User, Camera } from 'lucide-react'

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

export default function ProfilePage() {
    const [name, setName] = useState('')
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const avatarInputRef = useRef<HTMLInputElement>(null)

    const router = useRouter()
    const supabase = createClient()
    const { user } = useAuth()

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setAvatarFile(file)
        setAvatarPreview(URL.createObjectURL(file))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setIsLoading(true)
        setError(null)

        try {
            let avatarUrl: string | null = null

            // Upload avatar if selected
            if (avatarFile) {
                const resized = await resizeImage(avatarFile)
                const filePath = `${user.id}/avatar.jpg`

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, resized, {
                        contentType: 'image/jpeg',
                        upsert: true,
                    })

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath)

                avatarUrl = `${publicUrl}?t=${Date.now()}`
            }

            // Update profile
            const updateData: any = { name: name.trim() }
            if (avatarUrl) updateData.avatar_url = avatarUrl

            const { error: updateError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', user.id)

            if (updateError) throw updateError

            // If there's a pending invite code, go directly to that invite page
            const pendingCode = sessionStorage.getItem('inviteCode')
            if (pendingCode) {
                router.push(`/invite/${pendingCode}`)
            } else {
                router.push('/onboarding/room') // Next step
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center space-y-4 text-center">
                {/* Avatar picker */}
                <button
                    type="button"
                    className="relative group"
                    onClick={() => avatarInputRef.current?.click()}
                >
                    <div className="h-24 w-24 rounded-full bg-zinc-900 border-2 border-zinc-700 overflow-hidden flex items-center justify-center">
                        {avatarPreview ? (
                            <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                            <User className="h-10 w-10 text-zinc-400" />
                        )}
                    </div>
                    <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="h-6 w-6 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-full bg-rose-500 flex items-center justify-center border-2 border-zinc-950">
                        <Camera className="h-3.5 w-3.5 text-white" />
                    </div>
                </button>
                <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarSelect}
                />

                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Set up your profile</h1>
                    <p className="text-sm text-zinc-400 mt-2">
                        Add a photo and name so your partner knows it&apos;s you.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Your name</label>
                    <Input
                        type="text"
                        placeholder="What should we call you?"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={isLoading}
                        minLength={2}
                        maxLength={50}
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || name.trim().length < 2}>
                    {isLoading ? 'Saving...' : 'Continue'}
                </Button>
            </form>
        </div>
    )
}
