'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Heart, Mail, Lock, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

type AuthView = 'signIn' | 'signUp' | 'verifyEmail'

export default function SignInPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [otp, setOtp] = useState('')
    const [otpLength, setOtpLength] = useState(6) // Default to 6, can expand to 8
    const [view, setView] = useState<AuthView>('signIn')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setMessage(null)

        try {
            if (view === 'signUp') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/app/questions`,
                        data: {
                            // Metadata can go here if needed
                        }
                    }
                })
                if (error) throw error
                setView('verifyEmail')
                setMessage('We have sent a one-time code to your email. Please check your inbox.')
            } else if (view === 'signIn') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
                router.push('/app/questions')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'signup',
            })
            if (error) throw error
            router.push('/onboarding/profile')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleResendOtp = async () => {
        setIsLoading(true)
        setError(null)
        setMessage(null)
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email,
            })
            if (error) throw error
            setMessage('New code sent!')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950">
            <div className="w-full max-w-sm space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4">
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="rounded-full bg-rose-500/10 p-5 shadow-2xl shadow-rose-500/20 ring-1 ring-rose-500/20">
                        <Heart className="h-10 w-10 text-rose-500 animate-pulse" strokeWidth={2.5} />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-t from-zinc-400 to-zinc-50 bg-clip-text text-transparent">
                            {view === 'verifyEmail' ? 'Verify Email' : 'The Two of Us'}
                        </h1>
                        <p className="text-zinc-400 text-sm font-medium">
                            {view === 'signIn' && 'Welcome back to your shared space.'}
                            {view === 'signUp' && 'Start your digital journey together today.'}
                            {view === 'verifyEmail' && `Enter the code we sent to ${email}`}
                        </p>
                    </div>
                </div>

                {view !== 'verifyEmail' ? (
                    <div className="space-y-6">
                        <div className="flex p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                            <button
                                onClick={() => { setView('signIn'); setError(null); }}
                                className={clsx(
                                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                                    view === 'signIn' ? "bg-zinc-800 text-zinc-50 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => { setView('signUp'); setError(null); }}
                                className={clsx(
                                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                                    view === 'signUp' ? "bg-zinc-800 text-zinc-50 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                New User
                            </button>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-4">
                            <div className="space-y-4">
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-rose-500 transition-colors" />
                                    <Input
                                        type="email"
                                        placeholder="Email"
                                        className="pl-10 bg-zinc-900 border-zinc-800 focus:ring-rose-500"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-rose-500 transition-colors" />
                                    <Input
                                        type="password"
                                        placeholder="Password"
                                        className="pl-10 bg-zinc-900 border-zinc-800 focus:ring-rose-500"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-in shake-in">
                                    <p className="text-xs text-red-500 font-medium">{error}</p>
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-11 bg-rose-600 text-zinc-50 hover:bg-rose-700 shadow-lg shadow-rose-900/20 font-bold tracking-wide"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        {view === 'signIn' ? 'Sign In' : 'Create Account'}
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-8 animate-in fade-in duration-500">
                        <div className="space-y-6">
                            <div className="flex justify-center gap-2 sm:gap-3">
                                {([...Array(otpLength)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={clsx(
                                            otpLength === 8 ? "w-8 h-12 sm:w-9 sm:h-14 text-xl" : "w-10 h-14 sm:w-12 sm:h-16 text-2xl",
                                            "border-2 rounded-xl flex items-center justify-center font-bold transition-all duration-300 shadow-sm",
                                            otp.length === i ? "border-rose-500 ring-4 ring-rose-500/10 bg-rose-500/5 scale-110" :
                                                otp.length > i ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-400" :
                                                    "border-zinc-800 bg-zinc-900/50 text-zinc-700"
                                        )}
                                    >
                                        {otp[i] || ''}
                                    </div>
                                )))}
                            </div>

                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 8)
                                    setOtp(val)
                                    if (val.length > 6) setOtpLength(8)
                                    else if (val.length === 0) setOtpLength(6)
                                }}
                                className="sr-only"
                                autoFocus
                                required
                                disabled={isLoading}
                            />

                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center animate-in shake-in">
                                    <p className="text-xs text-red-500 font-medium">{error}</p>
                                </div>
                            )}

                            {message && (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                                    <p className="text-xs text-emerald-400 font-medium">{message}</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <Button
                                type="submit"
                                className="w-full h-12 bg-rose-600 text-zinc-50 hover:bg-rose-700 font-bold"
                                disabled={isLoading || (otp.length !== 6 && otp.length !== 8)}
                            >
                                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Verify Code'}
                            </Button>

                            <div className="flex flex-col space-y-2">
                                <button
                                    type="button"
                                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1 flex items-center justify-center gap-1"
                                    onClick={handleResendOtp}
                                    disabled={isLoading}
                                >
                                    <RefreshCw className={clsx("h-3 w-3", isLoading && "animate-spin")} />
                                    Resend code
                                </button>
                                <button
                                    type="button"
                                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1 flex items-center justify-center gap-1"
                                    onClick={() => { setView('signUp'); setOtp(''); setError(null); setMessage(null); }}
                                    disabled={isLoading}
                                >
                                    <ArrowLeft className="h-3 w-3" />
                                    Go back
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                <p className="text-center text-xs text-zinc-600 px-8">
                    By signing in, you agree to our terms of service for this private service.
                </p>
            </div>
        </div>
    )
}
