'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/supabase/auth-provider'
import { CalendarHeart } from 'lucide-react'

export default function AnniversaryPage() {
    const [date, setDate] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()
    const { user } = useAuth()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !date) return

        setIsLoading(true)
        setError(null)

        try {
            // 1. Get user's room
            const { data: member } = await supabase
                .from('room_members')
                .select('room_id')
                .eq('user_id', user.id)
                .single()

            if (!member) throw new Error('No room found')

            // 2. Update room anniversary
            const { error: updateError } = await supabase
                .from('rooms')
                .update({ anniversary_date: date })
                .eq('id', member.room_id)

            if (updateError) throw updateError

            // 3. Log to audit (optional, assuming trigger or direct insert)
            // await supabase.from('audit').insert({ room_id: member.room_id, action: 'set_anniversary', user_id: user.id })

            router.push('/app/questions')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="rounded-full bg-rose-500/10 p-4">
                    <CalendarHeart className="h-8 w-8 text-rose-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">When did it all begin?</h1>
                    <p className="text-sm text-zinc-400 mt-2">
                        Set your anniversary date so we can celebrate milestones together.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Input
                        type="date"
                        max={new Date().toISOString().split('T')[0]} // Max today
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        disabled={isLoading}
                        className="text-center"
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <div className="pt-4 space-y-3">
                    <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-zinc-50" disabled={isLoading || !date}>
                        {isLoading ? 'Saving...' : 'Start using the app'}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => router.push('/app/questions')}
                        disabled={isLoading}
                    >
                        Skip for now
                    </Button>
                </div>
            </form>
        </div>
    )
}
