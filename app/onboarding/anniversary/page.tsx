'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/supabase/auth-provider'
import { CalendarHeart, ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslations } from '@/lib/i18n'

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1
}

export default function AnniversaryPage() {
    const t = useTranslations()
    const MONTH_NAMES = [
        t('months.january'), t('months.february'), t('months.march'), t('months.april'),
        t('months.may'), t('months.june'), t('months.july'), t('months.august'),
        t('months.september'), t('months.october'), t('months.november'), t('months.december')
    ]
    const DAY_LABELS = [
        t('days.mon'), t('days.tue'), t('days.wed'), t('days.thu'),
        t('days.fri'), t('days.sat'), t('days.sun')
    ]
    const ot = useTranslations('onboarding')
    const today = new Date()
    const [viewYear, setViewYear] = useState(today.getFullYear())
    const [viewMonth, setViewMonth] = useState(today.getMonth())
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [mode, setMode] = useState<'month' | 'year'>('month')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()
    const { user } = useAuth()

    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const handlePrevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
        else setViewMonth(m => m - 1)
    }
    const handleNextMonth = () => {
        // Don't go past current month
        if (viewYear === today.getFullYear() && viewMonth >= today.getMonth()) return
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
        else setViewMonth(m => m + 1)
    }

    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
    const isCurrentMonthView = viewYear === today.getFullYear() && viewMonth === today.getMonth()

    const handleSelectDay = (day: number) => {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        if (dateStr > todayStr) return // Can't select future
        setSelectedDate(dateStr)
    }

    const handleSubmit = async () => {
        if (!user || !selectedDate) return

        setIsLoading(true)
        setError(null)

        try {
            const { data: member } = await supabase
                .from('room_members')
                .select('room_id')
                .eq('user_id', user.id)
                .single()

            if (!member) {
                router.push('/onboarding/room')
                return
            }

            const { error: updateError } = await supabase
                .from('rooms')
                .update({ anniversary_date: selectedDate })
                .eq('id', member.room_id)

            if (updateError) throw updateError

            router.push('/app/questions')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    // Format selected date for display
    const formatSelected = (d: string) => {
        const [y, m, day] = d.split('-').map(Number)
        return `${day}. ${MONTH_NAMES[m - 1]} ${y}`
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="rounded-full bg-rose-500/10 p-4">
                    <CalendarHeart className="h-8 w-8 text-rose-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{ot('whenDidItBegin')}</h1>
                    <p className="text-sm text-zinc-400 mt-2">
                        {ot('anniversaryDesc')}
                    </p>
                </div>
            </div>

            {/* Calendar */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                {mode === 'month' ? (
                    <>
                        {/* Month/Year header */}
                        <div className="flex items-center justify-between">
                            <button type="button" onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100">
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('year')}
                                className="text-sm font-semibold hover:text-rose-400 transition-colors px-3 py-1 rounded-lg hover:bg-zinc-800"
                            >
                                {MONTH_NAMES[viewMonth]} {viewYear}
                            </button>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                className={clsx(
                                    "p-2 rounded-lg transition-colors",
                                    isCurrentMonthView ? "text-zinc-700 cursor-not-allowed" : "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                                )}
                                disabled={isCurrentMonthView}
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Day labels */}
                        <div className="grid grid-cols-7 gap-1">
                            {DAY_LABELS.map(d => (
                                <div key={d} className="text-center text-[10px] font-semibold text-zinc-600 uppercase py-1">{d}</div>
                            ))}
                        </div>

                        {/* Days grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {/* Empty cells for offset */}
                            {[...Array(firstDay)].map((_, i) => (
                                <div key={`empty-${i}`} />
                            ))}
                            {[...Array(daysInMonth)].map((_, i) => {
                                const day = i + 1
                                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                const isFuture = dateStr > todayStr
                                const isSelected = selectedDate === dateStr
                                const isToday = dateStr === todayStr

                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => handleSelectDay(day)}
                                        disabled={isFuture}
                                        className={clsx(
                                            "aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-150",
                                            isFuture && "text-zinc-800 cursor-not-allowed",
                                            isSelected && "bg-rose-600 text-white shadow-lg shadow-rose-600/20 scale-110",
                                            isToday && !isSelected && "ring-1 ring-rose-500/40 text-rose-400",
                                            !isSelected && !isFuture && !isToday && "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
                                        )}
                                    >
                                        {day}
                                    </button>
                                )
                            })}
                        </div>
                    </>
                ) : (
                    /* Month overview / year picker */
                    <>
                        <div className="flex items-center justify-between">
                            <button type="button" onClick={() => setViewYear(y => y - 1)} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100">
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <span className="text-sm font-semibold">{viewYear}</span>
                            <button
                                type="button"
                                onClick={() => { if (viewYear < today.getFullYear()) setViewYear(y => y + 1) }}
                                className={clsx(
                                    "p-2 rounded-lg transition-colors",
                                    viewYear >= today.getFullYear() ? "text-zinc-700 cursor-not-allowed" : "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                                )}
                                disabled={viewYear >= today.getFullYear()}
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {MONTH_NAMES.map((name, i) => {
                                const isFuture = viewYear === today.getFullYear() && i > today.getMonth()
                                const isActive = viewMonth === i && mode === 'year'
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        disabled={isFuture}
                                        onClick={() => { setViewMonth(i); setMode('month') }}
                                        className={clsx(
                                            "py-3 rounded-xl text-sm font-medium transition-all",
                                            isFuture && "text-zinc-800 cursor-not-allowed",
                                            !isFuture && "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
                                        )}
                                    >
                                        {name.slice(0, 3)}
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}

                {/* Selected date display */}
                {selectedDate && (
                    <div className="text-center pt-2 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500">{ot('selected')}</p>
                        <p className="text-sm font-semibold text-rose-400">{formatSelected(selectedDate)}</p>
                    </div>
                )}
            </div>

            {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <div className="space-y-3">
                <Button
                    type="button"
                    className="w-full bg-rose-600 hover:bg-rose-700 text-zinc-50"
                    disabled={isLoading || !selectedDate}
                    onClick={handleSubmit}
                >
                    {isLoading ? ot('saving') : ot('startApp')}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => router.push('/app/questions')}
                    disabled={isLoading}
                >
                    {ot('skipForNow')}
                </Button>
            </div>
        </div>
    )
}
