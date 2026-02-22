import { BottomNav, SideNav } from "@/components/navigation"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen w-full flex-col md:flex-row bg-zinc-950">
            <SideNav />
            <main className="flex-1 pb-16 md:pb-0 w-full max-w-2xl mx-auto">
                {children}
            </main>
            <BottomNav />
        </div>
    )
}
