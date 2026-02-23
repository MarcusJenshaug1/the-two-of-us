'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/supabase/auth-provider'
import { HeartHandshake } from 'lucide-react'

export default function InviteClient({ code }: { code: string }) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()
    const { user, isLoading: authLoading } = useAuth()

    useEffect(() => {
        if (authLoading) return

        // If not logged in, save invite code and redirect to sign-in
        if (!user) {
            sessionStorage.setItem('inviteCode', code)
            router.push('/sign-in')
            return
        }

        const processInvite = async () => {
            try {
                setIsLoading(true)

                // 1. Check if user already has a profile name (new users won't)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name')
                    .eq('id', user.id)
                    .single()

                const hasProfile = profile?.name && profile.name.trim().length > 0

                // 2. Check if user already in a room
                const { data: member } = await supabase
                    .from('room_members')
                    .select('room_id')
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (member) {
                    // Already in a room — go to questions
                    router.push('/app/questions')
                    return
                }

                // 3. If no profile name, save code and go to profile setup first
                if (!hasProfile) {
                    sessionStorage.setItem('inviteCode', code)
                    router.push('/onboarding/profile')
                    return
                }

                // 4. Find room with code
                const { data: roomData, error: findError } = await supabase
                    .from('rooms')
                    .select('id, created_by')
                    .eq('invite_code', code.toUpperCase())
                    .single()

                if (findError || !roomData) throw new Error('Invalid or expired invite link.')

                // 5. Join the room
                const { error: joinError } = await supabase
                    .from('room_members')
                    .insert({
                        room_id: roomData.id,
                        user_id: user.id
                    })

                if (joinError) {
                    throw new Error('Could not join room. It might be full.')
                }

                // Clear saved code
                sessionStorage.removeItem('inviteCode')

                // Successfully joined — go to questions
                router.push('/app/questions')
            } catch (err: any) {
                setError(err.message)
            } finally {
                setIsLoading(false)
            }
        }

        processInvite()
    }, [user, authLoading, code, router, supabase])

    if (isLoading || authLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950">
                <div className="animate-pulse flex flex-col items-center space-y-4">
                    <HeartHandshake className="h-8 w-8 text-rose-500 animate-bounce" />
                    <p className="text-zinc-400">Accepting invitation...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950">
                <div className="w-full max-w-sm space-y-6 text-center">
                    <div className="rounded-full bg-red-500/10 p-4 mx-auto w-fit">
                        <HeartHandshake className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Oops!</h1>
                    <p className="text-sm text-zinc-400">{error}</p>
                    <Button
                        className="w-full bg-zinc-800 text-zinc-50 hover:bg-zinc-700"
                        onClick={() => router.push('/onboarding/room')}
                    >
                        Go to Room Setup
                    </Button>
                </div>
            </div>
        )
    }

    return null
}
