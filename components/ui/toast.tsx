'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, X, Heart, Info } from 'lucide-react'
import { clsx } from 'clsx'

type ToastType = 'success' | 'error' | 'info' | 'love'

interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastContextType {
    toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
    return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const toast = useCallback((message: string, type: ToastType = 'success') => {
        const id = `${Date.now()}_${Math.random()}`
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 3500)
    }, [])

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const icon = (type: ToastType) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            case 'error': return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            case 'love': return <Heart className="w-4 h-4 text-rose-400 shrink-0" />
            case 'info': return <Info className="w-4 h-4 text-blue-400 shrink-0" />
        }
    }

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}

            {/* Toast container */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={clsx(
                            'pointer-events-auto w-full flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300',
                            t.type === 'success' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
                            t.type === 'error' && 'bg-red-500/10 border-red-500/20 text-red-300',
                            t.type === 'love' && 'bg-rose-500/10 border-rose-500/20 text-rose-300',
                            t.type === 'info' && 'bg-blue-500/10 border-blue-500/20 text-blue-300',
                        )}
                    >
                        {icon(t.type)}
                        <p className="text-sm font-medium flex-1">{t.message}</p>
                        <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
