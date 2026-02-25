// Edge Function: send-push-notification
// Sends Web Push notifications with proper VAPID auth + RFC 8291 encryption

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const VAPID_SUBJECT = "mailto:hello@us2.one"
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || ""
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || ""

// ─── Base64url utilities ───
function b64urlToBytes(b64url: string): Uint8Array {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
    const pad = (4 - (b64.length % 4)) % 4
    const padded = b64 + "=".repeat(pad)
    const binary = atob(padded)
    return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function bytesToB64url(bytes: Uint8Array): string {
    const b64 = btoa(String.fromCharCode(...bytes))
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

// ─── VAPID JWT (ES256) ───
async function createVapidJwt(audience: string): Promise<string> {
    const pubBytes = b64urlToBytes(VAPID_PUBLIC_KEY)
    const x = bytesToB64url(pubBytes.slice(1, 33))
    const y = bytesToB64url(pubBytes.slice(33, 65))

    const key = await crypto.subtle.importKey(
        "jwk",
        { kty: "EC", crv: "P-256", x, y, d: VAPID_PRIVATE_KEY },
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
    )

    const header = bytesToB64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })))
    const payload = bytesToB64url(
        new TextEncoder().encode(
            JSON.stringify({
                aud: audience,
                exp: Math.floor(Date.now() / 1000) + 12 * 3600,
                sub: VAPID_SUBJECT,
            })
        )
    )

    const unsigned = `${header}.${payload}`
    const sig = new Uint8Array(
        await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned))
    )
    return `${unsigned}.${bytesToB64url(sig)}`
}

// ─── HKDF helpers ───
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm))
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    const input = new Uint8Array(info.length + 1)
    input.set(info)
    input[info.length] = 1
    const result = new Uint8Array(await crypto.subtle.sign("HMAC", key, input))
    return result.slice(0, len)
}

// ─── RFC 8291 Web Push Encryption (aes128gcm) ───
async function encryptPayload(
    payloadText: string,
    subscriberPubB64: string,
    subscriberAuthB64: string
): Promise<Uint8Array> {
    const subscriberPub = b64urlToBytes(subscriberPubB64)
    const subscriberAuth = b64urlToBytes(subscriberAuthB64)

    // 1. Ephemeral ECDH keypair
    const localKp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])
    const localPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKp.publicKey))

    // 2. ECDH shared secret
    const subKey = await crypto.subtle.importKey("raw", subscriberPub, { name: "ECDH", namedCurve: "P-256" }, false, [])
    const sharedSecret = new Uint8Array(
        await crypto.subtle.deriveBits({ name: "ECDH", public: subKey }, localKp.privateKey, 256)
    )

    // 3. Derive IKM
    const prk1 = await hkdfExtract(subscriberAuth, sharedSecret)
    const infoPrefix = new TextEncoder().encode("WebPush: info\0")
    const ikmInfo = new Uint8Array(infoPrefix.length + subscriberPub.length + localPubRaw.length)
    ikmInfo.set(infoPrefix)
    ikmInfo.set(subscriberPub, infoPrefix.length)
    ikmInfo.set(localPubRaw, infoPrefix.length + subscriberPub.length)
    const ikm = await hkdfExpand(prk1, ikmInfo, 32)

    // 4. Salt + derive CEK and nonce
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const prk2 = await hkdfExtract(salt, ikm)
    const cek = await hkdfExpand(prk2, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16)
    const nonce = await hkdfExpand(prk2, new TextEncoder().encode("Content-Encoding: nonce\0"), 12)

    // 5. Pad + encrypt
    const payloadBytes = new TextEncoder().encode(payloadText)
    const padded = new Uint8Array(payloadBytes.length + 1)
    padded.set(payloadBytes)
    padded[payloadBytes.length] = 2

    const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"])
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded))

    // 6. Build aes128gcm body: salt(16) || rs(4) || idLen(1) || keyId(65) || ciphertext
    const rs = new Uint8Array(4)
    new DataView(rs.buffer).setUint32(0, 4096)

    const body = new Uint8Array(16 + 4 + 1 + localPubRaw.length + ciphertext.length)
    body.set(salt, 0)
    body.set(rs, 16)
    body[20] = localPubRaw.length
    body.set(localPubRaw, 21)
    body.set(ciphertext, 21 + localPubRaw.length)

    return body
}

// ─── Main handler ───
Deno.serve(async (req) => {
    try {
        const { user_id, title, body, url, tag, badge } = await req.json()

        if (!user_id || !title || !body) {
            return new Response(JSON.stringify({ error: "Missing user_id, title, or body" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            })
        }

        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

        const { data: subscriptions, error } = await supabase
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", user_id)

        if (error) throw error
        if (!subscriptions?.length) {
            return new Response(JSON.stringify({ sent: 0, message: "No subscriptions" }), {
                headers: { "Content-Type": "application/json" },
            })
        }

        const notifPayload = JSON.stringify({ title, body, url, tag, badge })
        let sent = 0
        let failed = 0
        const staleEndpoints: string[] = []
        const debugErrors: string[] = []

        for (const sub of subscriptions) {
            try {
                const audience = new URL(sub.endpoint).origin
                const jwt = await createVapidJwt(audience)
                const encrypted = await encryptPayload(notifPayload, sub.p256dh, sub.auth)

                const response = await fetch(sub.endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/octet-stream",
                        "Content-Encoding": "aes128gcm",
                        TTL: "86400",
                        Urgency: "high",
                        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
                    },
                    body: encrypted,
                })

                if (response.status === 201 || response.status === 200) {
                    sent++
                } else if (response.status === 404 || response.status === 410) {
                    staleEndpoints.push(sub.endpoint)
                    failed++
                } else {
                    const text = await response.text()
                    debugErrors.push(`HTTP ${response.status}: ${text}`)
                    console.error(`Push failed (${response.status}):`, text)
                    failed++
                }
            } catch (err) {
                debugErrors.push(`Error: ${String(err)}`)
                console.error("Push error:", err)
                failed++
            }
        }

        if (staleEndpoints.length > 0) {
            await supabase
                .from("push_subscriptions")
                .delete()
                .eq("user_id", user_id)
                .in("endpoint", staleEndpoints)
        }

        return new Response(JSON.stringify({ sent, failed, cleaned: staleEndpoints.length, errors: debugErrors }), {
            headers: { "Content-Type": "application/json" },
        })
    } catch (err) {
        console.error("Error:", err)
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
})
