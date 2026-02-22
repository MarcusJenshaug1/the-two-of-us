import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { formatInTimeZone } from "https://esm.sh/date-fns-tz@2"

const TIMEZONE = "Europe/Oslo"

Deno.serve(async (req) => {
    try {
        // 1. Initialize Supabase with Service Role Key
        const supabaseUrl = Deno.env.get("SUPABASE_URL") as string
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string

        if (!supabaseUrl || !supabaseServiceKey) {
            return new Response("Missing env vars", { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Calculate current Oslo date key based on 06:00 cutoff
        const today = new Date()
        const osloHour = parseInt(formatInTimeZone(today, TIMEZONE, 'HH'), 10)

        // If running at 06:00, this will generate today's date perfectly.
        // We add a safety net just in case: if it runs manually before 6am, it applies to previous day.
        const businessDate = osloHour < 6
            ? new Date(today.getTime() - 24 * 60 * 60 * 1000)
            : today

        const dateKey = formatInTimeZone(businessDate, TIMEZONE, 'yyyy-MM-dd')

        // 2. Fetch all active rooms
        const { data: rooms, error: roomsError } = await supabase
            .from("rooms")
            .select("id")

        if (roomsError) throw roomsError

        // 3. For each room, pick a random question they haven't seen in the last 60 days
        let addedCount = 0
        let skippedCount = 0

        // Optimize: fetch all questions once
        const { data: allQuestions, error: qError } = await supabase
            .from("questions")
            .select("id")

        if (qError) throw qError
        const allQuestionIds = allQuestions.map(q => q.id)

        for (const room of rooms) {
            // Check if they already have one for today
            const { data: existingDq } = await supabase
                .from("daily_questions")
                .select("id")
                .eq("room_id", room.id)
                .eq("date_key", dateKey)
                .single()

            if (existingDq) {
                skippedCount++
                continue
            }

            // Get recent questions for this room (last 60)
            const { data: recentQs } = await supabase
                .from("daily_questions")
                .select("question_id")
                .eq("room_id", room.id)
                .order("created_at", { ascending: false })
                .limit(60)

            const recentIds = recentQs ? recentQs.map(q => q.question_id) : []
            const availableIds = allQuestionIds.filter(id => !recentIds.includes(id))

            // Pick randomly
            let selectedQuestionId
            if (availableIds.length > 0) {
                selectedQuestionId = availableIds[Math.floor(Math.random() * availableIds.length)]
            } else {
                // Fallback: pick completely random if somehow they answered all questions
                selectedQuestionId = allQuestionIds[Math.floor(Math.random() * allQuestionIds.length)]
            }

            if (selectedQuestionId) {
                // Insert new daily_question
                const { error: insertError } = await supabase
                    .from("daily_questions")
                    .insert({
                        room_id: room.id,
                        date_key: dateKey,
                        question_id: selectedQuestionId
                    })

                if (insertError) {
                    console.error(`Failed to insert for room ${room.id}`, insertError)
                } else {
                    addedCount++
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            dateKey,
            added: addedCount,
            skipped: skippedCount
        }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        })
    }
})
