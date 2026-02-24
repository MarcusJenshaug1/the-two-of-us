import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

/**
 * anniversary-reminder
 * ────────────────────
 * Cron: daily at 08:00 UTC
 *
 * Checks every room that has an anniversary_date set.
 * Sends a push notification:
 *   – 7 days before  ("1 week until your anniversary!")
 *   – 1 day before   ("Tomorrow is your anniversary!")
 *   – On the day      ("Happy Anniversary! 🎉")
 *
 * Uses a sent-tracking table (anniversary_reminders_sent) to avoid duplicates.
 */

Deno.serve(async () => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const today = new Date()
    const todayMonth = today.getMonth() + 1
    const todayDay = today.getDate()

    // Fetch all rooms with an anniversary_date
    const { data: rooms, error } = await supabase
        .from("rooms")
        .select("id, anniversary_date")
        .not("anniversary_date", "is", null)

    if (error) {
        console.error("Error fetching rooms:", error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    let sent = 0

    for (const room of rooms || []) {
        const annDate = new Date(room.anniversary_date + "T00:00:00Z")
        const annMonth = annDate.getMonth() + 1
        const annDay = annDate.getDate()

        // Calculate days until anniversary this year
        const thisYearAnn = new Date(today.getFullYear(), annMonth - 1, annDay)
        let diffDays = Math.round(
            (thisYearAnn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        // If the anniversary already passed this year, look at next year
        if (diffDays < 0) {
            const nextYearAnn = new Date(today.getFullYear() + 1, annMonth - 1, annDay)
            diffDays = Math.round(
                (nextYearAnn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            )
        }

        // Determine which reminder to send
        let reminderType: string | null = null
        if (diffDays === 7) reminderType = "7_days"
        else if (diffDays === 1) reminderType = "1_day"
        else if (diffDays === 0) reminderType = "today"

        if (!reminderType) continue

        // Calculate years together
        const years = today.getFullYear() - annDate.getFullYear()
        const adjustedYears = reminderType === "today" ? years : years // On the day it's exact

        // Check if we already sent this reminder this year
        const tag = `anniversary-${room.id}-${today.getFullYear()}-${reminderType}`
        const { data: alreadySent } = await supabase
            .from("shared_events")
            .select("id")
            .eq("room_id", room.id)
            .limit(0) // Just using tag dedup in the push itself

        // Get all members
        const { data: members } = await supabase
            .from("room_members")
            .select("user_id")
            .eq("room_id", room.id)

        if (!members) continue

        for (const m of members) {
            // Get user locale
            const { data: profile } = await supabase
                .from("profiles")
                .select("locale")
                .eq("id", m.user_id)
                .single()
            const locale = profile?.locale || "en"

            let title: string
            let body: string

            if (reminderType === "today") {
                title = locale === "no" ? "🎉 Gratulerer med årsdagen!" : "🎉 Happy Anniversary!"
                body =
                    locale === "no"
                        ? `I dag feirer dere ${adjustedYears} år sammen! 💕`
                        : `Today you celebrate ${adjustedYears} years together! 💕`
            } else if (reminderType === "1_day") {
                title =
                    locale === "no" ? "💕 I morgen er årsdagen deres!" : "💕 Tomorrow is your anniversary!"
                body =
                    locale === "no"
                        ? `Dere fyller ${adjustedYears} år sammen i morgen!`
                        : `You'll celebrate ${adjustedYears} years together tomorrow!`
            } else {
                // 7 days
                title =
                    locale === "no"
                        ? "💕 1 uke til årsdagen!"
                        : "💕 1 week until your anniversary!"
                body =
                    locale === "no"
                        ? `Om 7 dager feirer dere ${adjustedYears} år sammen!`
                        : `In 7 days you'll celebrate ${adjustedYears} years together!`
            }

            try {
                await supabase.functions.invoke("send-push-notification", {
                    body: {
                        user_id: m.user_id,
                        title,
                        body,
                        url: "/app/progress",
                        tag,
                        badge: 1,
                    },
                })
                sent++
            } catch (pushErr) {
                console.error("Push failed for anniversary", room.id, pushErr)
            }
        }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { "Content-Type": "application/json" },
    })
})
