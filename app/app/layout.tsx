import { redirect } from "next/navigation"
import { BottomNav, SideNav } from "@/components/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/sign-in')
    }

    // Check if user belongs to a room
    const { data: membership } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (!membership) {
        redirect('/onboarding/room')
    }

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
