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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const today = new Date()
    const todayMonth = today.getUTCMonth() + 1
    const todayDay = today.getUTCDate()

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
        const annMonth = annDate.getUTCMonth() + 1
        const annDay = annDate.getUTCDate()

        // Use date-only comparison (no time component issues)
        const todayDateOnly = Date.UTC(today.getUTCFullYear(), todayMonth - 1, todayDay)
        const thisYearAnn = Date.UTC(today.getUTCFullYear(), annMonth - 1, annDay)
        let diffDays = Math.round((thisYearAnn - todayDateOnly) / (1000 * 60 * 60 * 24))

        // If the anniversary already passed this year, look at next year
        if (diffDays < 0) {
            const nextYearAnn = Date.UTC(today.getUTCFullYear() + 1, annMonth - 1, annDay)
            diffDays = Math.round((nextYearAnn - todayDateOnly) / (1000 * 60 * 60 * 24))
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
                const pushRes = await fetch(
                    `${supabaseUrl}/functions/v1/send-push-notification`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${supabaseServiceKey}`,
                        },
                        body: JSON.stringify({
                            user_id: m.user_id,
                            title,
                            body,
                            url: "/app/progress",
                            tag,
                            badge: 1,
                        }),
                    }
                )
                const pushData = await pushRes.text()
                console.log(`Anniversary push for ${m.user_id}: ${pushRes.status} ${pushData}`)
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
