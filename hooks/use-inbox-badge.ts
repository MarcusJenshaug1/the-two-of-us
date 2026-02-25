'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Counts "your turn" questions — partner answered but you haven't.
 * Subscribes to real-time answer changes so the badge updates live.
 */
export function useInboxBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function fetchCount() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      // Get room members
      const { data: members } = await supabase
        .from('room_members')
        .select('room_id, user_id')
      if (!members || members.length < 2 || cancelled) return

      const me = members.find(m => m.user_id === user.id)
      const partner = members.find(m => m.user_id !== user.id)
      if (!me || !partner) return

      // Recent questions (last 7 days) with answers
      const today = new Date().toISOString().slice(0, 10)
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

      const { data: questions } = await supabase
        .from('daily_questions')
        .select('id, answers(user_id)')
        .eq('room_id', me.room_id)
        .gte('date_key', weekAgo)
        .lte('date_key', today)

      if (cancelled) return

      // Count where partner answered but I haven't
      let yourTurn = 0
      for (const q of (questions || [])) {
        const ans = (q.answers || []) as { user_id: string }[]
        const partnerAnswered = ans.some(a => a.user_id === partner.user_id)
        const iAnswered = ans.some(a => a.user_id === user.id)
        if (partnerAnswered && !iAnswered) yourTurn++
      }

      if (!cancelled) setCount(yourTurn)
    }

    fetchCount()

    // Live updates when answers change
    channel = supabase
      .channel('inbox-badge')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'answers',
      }, () => { fetchCount() })
      .subscribe()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return count
}
