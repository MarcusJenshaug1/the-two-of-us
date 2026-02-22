'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/supabase/auth-provider'
import { User } from 'lucide-react'

export default function ProfilePage() {
    const [name, setName] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()
    const { user } = useAuth()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setIsLoading(true)
        setError(null)

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ name: name.trim() })
                .eq('id', user.id)

            if (updateError) throw updateError

            router.push('/onboarding/room') // Next step
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="rounded-full bg-zinc-900 p-4">
                    <User className="h-8 w-8 text-zinc-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">What should we call you?</h1>
                    <p className="text-sm text-zinc-400 mt-2">
                        This is how your partner will see you in the app.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Input
                        type="text"
                        placeholder="Your name"
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
