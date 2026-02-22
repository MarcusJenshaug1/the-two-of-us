import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/sign-in')
    }

    // Check if user has a room
    const { data: membership } = await supabase
        .from('room_members')
        .select('room_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (!membership) {
        redirect('/onboarding/room')
    }

    redirect('/app/questions')
}
