'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/supabase/auth-provider'
import { format, differenceInDays, differenceInMonths, differenceInYears, parseISO } from 'date-fns'
import { CalendarHeart, Flame, Trophy, Activity, Calendar } from 'lucide-react'

export default function ProgressPage() {
    const [stats, setStats] = useState<any>(null)
    const [room, setRoom] = useState<any>(null)
    const [activityMap, setActivityMap] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const supabase = createClient()
    const { user } = useAuth()

    useEffect(() => {
        if (!user) return
        let mounted = true

        const loadProgress = async () => {
            try {
                // 1. Get room
                const { data: member } = await supabase
                    .from('room_members')
                    .select('room_id, rooms(anniversary_date, created_at)')
                    .eq('user_id', user.id)
                    .single()

                if (!member) return
                const roomData = Array.isArray(member.rooms) ? member.rooms[0] : member.rooms
                setRoom(roomData)

                // 2. Get stats
                const { data: statsData } = await supabase
                    .from('stats')
                    .select('*')
                    .eq('room_id', member.room_id)
                    .single()

                setStats(statsData)

                // 3. Get activity data via RPC (last 90 days)
                const { data: activityData } = await supabase.rpc('get_activity_data', {
                    room_id_param: member.room_id,
                    user_id_param: user.id,
                    days_param: 90
                })

                if (activityData) {
                    setActivityMap(activityData)
                }

            } catch (err) {
                console.error('Error loading progress', err)
            } finally {
                if (mounted) setIsLoading(false)
            }
        }

        loadProgress()
        return () => { mounted = false }
    }, [user, supabase])

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-800" />
            </div>
        )
    }

    // Calculate Time Together
    let timeStr = "Just started!"
    let totalDays = 0
    if (room?.anniversary_date) {
        const start = parseISO(room.anniversary_date)
        const now = new Date()
        totalDays = differenceInDays(now, start)
        const years = differenceInYears(now, start)
        const months = differenceInMonths(now, start) % 12
        const days = differenceInDays(now, new Date(start.getFullYear() + years, start.getMonth() + months, start.getDate()))

        const timeParts: string[] = []
        if (years > 0) timeParts.push(`${years}y`)
        if (months > 0) timeParts.push(`${months}m`)
        if (days > 0 || timeParts.length === 0) timeParts.push(`${days}d`)
        timeStr = timeParts.join(' ')
    }

    // Calculate Next Milestone
    const milestones = [100, 200, 365, 500, 1000]
    const nextMilestone = milestones.find(m => m > totalDays)
    const daysToMilestone = nextMilestone ? nextMilestone - totalDays : null

    return (
        <div className="p-4 space-y-8 pt-8 md:pt-12 pb-24">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
                <p className="text-sm text-zinc-400">Your journey together.</p>
            </div>

            {/* Time Together Card */}
            <div className="bg-gradient-to-br from-rose-500/20 to-zinc-900 border border-rose-500/20 rounded-3xl p-6 text-center space-y-2 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 text-rose-500/10">
                    <CalendarHeart className="w-40 h-40" />
                </div>
                <p className="text-sm font-medium text-rose-400 uppercase tracking-widest relative z-10">Together for</p>
                <h2 className="text-4xl font-bold tracking-tight relative z-10">{timeStr}</h2>
                <p className="text-sm text-zinc-400 relative z-10">{totalDays} total days</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                        <Flame className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="text-2xl font-semibold">{stats?.current_streak || 0}</p>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Current Streak</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                        <Trophy className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-semibold">{stats?.best_streak || 0}</p>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Best Streak</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                        <Activity className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-semibold">{stats?.total_answered || 0}</p>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Answered</p>
                </div>

                {daysToMilestone && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                        </div>
                        <p className="text-2xl font-semibold">{daysToMilestone}</p>
                        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Days to {nextMilestone}</p>
                    </div>
                )}
            </div>

            {/* Activity Heatmap Mock/Simple implementation */}
            <div className="space-y-4 pt-4">
                <h3 className="font-semibold text-lg">Last 90 Days Activity</h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 overflow-x-auto">
                    {activityMap.length > 0 ? (
                        <div className="flex gap-1">
                            {activityMap.map((day, i) => (
                                <div
                                    key={i}
                                    className={`w-3 h-12 rounded-sm flex-shrink-0 ${day.status === 'both_answered' ? 'bg-rose-500' :
                                            day.status === 'you_answered' ? 'bg-zinc-600' :
                                                'bg-zinc-800'
                                        }`}
                                    title={`${day.date_key}: ${day.status}`}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-zinc-500 text-center py-4">
                            Activity data requires the get_activity_data RPC function to be deployed.
                        </p>
                    )}
                    <div className="flex items-center justify-end space-x-4 mt-6 text-xs text-zinc-500">
                        <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-zinc-800 mr-2" /> Missed</div>
                        <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-zinc-600 mr-2" /> Partial</div>
                        <div className="flex items-center"><div className="w-2 h-2 rounded-sm bg-rose-500 mr-2" /> Completed</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
