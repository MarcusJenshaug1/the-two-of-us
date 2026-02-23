import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

/**
 * due-reminders
 * ─────────────
 * Cron: every 5 minutes
 *
 * Scans shared_events and shared_tasks for rows where
 *   reminder_at <= now()  AND  reminder_sent_at IS NULL
 * then sends a push notification to every member in the room
 * and marks reminder_sent_at to prevent re-sends.
 */

const BATCH_LIMIT = 50

Deno.serve(async (_req) => {
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") as string
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string

        if (!supabaseUrl || !supabaseServiceKey) {
            return new Response("Missing env vars", { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const now = new Date().toISOString()
        let sentCount = 0

        // ─── 1. Due Event Reminders ───
        const { data: dueEvents, error: evErr } = await supabase
            .from("shared_events")
            .select("id, room_id, title")
            .lte("reminder_at", now)
            .is("reminder_sent_at", null)
            .limit(BATCH_LIMIT)

        if (evErr) throw evErr

        for (const ev of dueEvents || []) {
            // Get room members
            const { data: members } = await supabase
                .from("room_members")
                .select("user_id")
                .eq("room_id", ev.room_id)

            if (members) {
                for (const m of members) {
                    try {
                        await supabase.functions.invoke("send-push-notification", {
                            body: {
                                user_id: m.user_id,
                                title: "📅 Upcoming event",
                                body: ev.title,
                                url: "/app/planner",
                                tag: `event-${ev.id}`,
                                badge: 1,
                            },
                        })
                    } catch (pushErr) {
                        console.error("Push failed for event", ev.id, pushErr)
                    }
                }
            }

            // Mark sent (idempotent — WHERE reminder_sent_at IS NULL)
            await supabase
                .from("shared_events")
                .update({ reminder_sent_at: now })
                .eq("id", ev.id)
                .is("reminder_sent_at", null)

            sentCount++
        }

        // ─── 2. Due Task Reminders ───
        const { data: dueTasks, error: tkErr } = await supabase
            .from("shared_tasks")
            .select("id, room_id, title")
            .lte("reminder_at", now)
            .is("reminder_sent_at", null)
            .eq("is_done", false)
            .limit(BATCH_LIMIT)

        if (tkErr) throw tkErr

        for (const task of dueTasks || []) {
            const { data: members } = await supabase
                .from("room_members")
                .select("user_id")
                .eq("room_id", task.room_id)

            if (members) {
                for (const m of members) {
                    try {
                        await supabase.functions.invoke("send-push-notification", {
                            body: {
                                user_id: m.user_id,
                                title: "✅ Task reminder",
                                body: task.title,
                                url: "/app/planner",
                                tag: `task-${task.id}`,
                                badge: 1,
                            },
                        })
                    } catch (pushErr) {
                        console.error("Push failed for task", task.id, pushErr)
                    }
                }
            }

            await supabase
                .from("shared_tasks")
                .update({ reminder_sent_at: now })
                .eq("id", task.id)
                .is("reminder_sent_at", null)

            sentCount++
        }

        return new Response(JSON.stringify({
            success: true,
            reminders_sent: sentCount,
            events_processed: dueEvents?.length || 0,
            tasks_processed: dueTasks?.length || 0,
        }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        })
    } catch (error: any) {
        console.error("due-reminders error:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        })
    }
})
