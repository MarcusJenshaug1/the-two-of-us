'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/supabase/auth-provider'
import { Home, Users } from 'lucide-react'

export default function RoomPage() {
    const [joinCode, setJoinCode] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<'choose' | 'join'>('choose')

    const router = useRouter()
    const supabase = createClient()
    const { user } = useAuth()

    // Auto-fill invite code from sessionStorage (from invite link)
    useEffect(() => {
        const pendingCode = sessionStorage.getItem('inviteCode')
        if (pendingCode) {
            setJoinCode(pendingCode.toUpperCase())
            setMode('join')
        }
    }, [])

    const generateRoomCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase()
    }

    const handleCreateRoom = async () => {
        if (!user) return
        setIsLoading(true)
        setError(null)

        try {
            const roomCode = generateRoomCode()

            // 1. Create room (without .select() to avoid RLS SELECT issue)
            const { error: roomError } = await supabase
                .from('rooms')
                .insert({
                    invite_code: roomCode,
                    created_by: user.id
                })

            if (roomError) throw roomError

            // 2. Find the room we just created (via RPC)
            const { data: lookupData, error: findError } = await supabase
                .rpc('lookup_room_by_invite_code', { p_invite_code: roomCode })

            if (findError || !lookupData || lookupData.length === 0) {
                throw new Error('Room was created but could not be found. Please try again.')
            }
            const roomData = { id: lookupData[0].room_id }

            // 3. Add user to room
            const { error: memberError } = await supabase
                .from('room_members')
                .insert({
                    room_id: roomData.id,
                    user_id: user.id
                })

            if (memberError) throw memberError

            router.push('/onboarding/anniversary')
        } catch (err: any) {
            setError(err.message || 'Failed to create room')
        } finally {
            setIsLoading(false)
        }
    }

    const handleJoinRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !joinCode.trim()) return

        setIsLoading(true)
        setError(null)

        try {
            // 1. Find room by secure RPC (least-privilege)
            const { data: lookupData, error: lookupError } = await supabase
                .rpc('lookup_room_by_invite_code', { p_invite_code: joinCode.trim().toUpperCase() })

            if (lookupError || !lookupData || lookupData.length === 0) {
                throw new Error('Room not found or invalid code')
            }

            const room = lookupData[0]
            if (room.is_full) {
                throw new Error('This room is already full.')
            }

            // 2. Join room (Trigger handles max 2 members logic ideally, or we catch constraint error)
            const { error: joinError } = await supabase
                .from('room_members')
                .insert({
                    room_id: room.room_id,
                    user_id: user.id
                })

            if (joinError) throw new Error('Failed to join room. It might be full.')

            sessionStorage.removeItem('inviteCode')
            router.push('/app/questions') // Skip anniversary if joining
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    if (mode === 'join') {
        return (
            <div className="space-y-6">
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="rounded-full bg-zinc-900 p-4">
                        <Users className="h-8 w-8 text-zinc-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Join your partner</h1>
                        <p className="text-sm text-zinc-400 mt-2">
                            Enter the 6-character code your partner shared with you.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleJoinRoom} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="text"
                            placeholder="e.g. AB12CD"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            required
                            disabled={isLoading}
                            className="text-center text-xl tracking-widest uppercase"
                            maxLength={6}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-500 text-center">{error}</p>
                    )}

                    <div className="pt-4 space-y-3">
                        <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-zinc-50" disabled={isLoading || joinCode.length < 6}>
                            {isLoading ? 'Joining...' : 'Join Room'}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            onClick={() => setMode('choose')}
                            disabled={isLoading}
                        >
                            Back
                        </Button>
                    </div>
                </form>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="rounded-full bg-rose-500/10 p-4">
                    <Home className="h-8 w-8 text-rose-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Set up your space</h1>
                    <p className="text-sm text-zinc-400 mt-2">
                        Create a new space for you and your partner, or join an existing one if they already created it.
                    </p>
                </div>
            </div>

            {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <div className="space-y-3 pt-4">
                <Button
                    className="w-full bg-rose-600 text-zinc-50 hover:bg-rose-700 h-12"
                    onClick={handleCreateRoom}
                    disabled={isLoading}
                >
                    {isLoading ? 'Creating...' : 'Create new space'}
                </Button>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-zinc-800" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-zinc-950 px-2 text-zinc-500">Or</span>
                    </div>
                </div>
                <Button
                    variant="outline"
                    className="w-full h-12"
                    onClick={() => setMode('join')}
                    disabled={isLoading}
                >
                    Join existing space
                </Button>
            </div>
        </div>
    )
}
