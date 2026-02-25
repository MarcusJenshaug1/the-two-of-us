import { BottomNav, SideNav } from "@/components/navigation"
import { ClearBadge } from "@/components/clear-badge"
import { NotificationPrompt } from "@/components/notification-prompt"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Room membership is enforced by middleware.
    // If user reaches here, they have a room.
    return (
        <div className="flex h-[100dvh] w-full flex-col md:flex-row bg-zinc-950 overflow-hidden">
            <ClearBadge />
            <NotificationPrompt />
            <SideNav />
            <main className="flex-1 overflow-y-auto overscroll-none pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 w-full max-w-2xl mx-auto">
                {children}
            </main>
            <BottomNav />
        </div>
    )
}
