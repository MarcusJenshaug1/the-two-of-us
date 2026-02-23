import { createClient } from '@/lib/supabase/client'

const SIGNED_URL_TTL = 300 // 5 minutes
const BUCKET = 'daily-logs'

// In-memory cache for signed URLs to avoid re-generating on every render
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

/**
 * Resolve an image reference to a displayable URL.
 *
 * Handles three formats:
 *  1. Object { bucket, path } → generate signed URL
 *  2. Relative path string (no http) → generate signed URL
 *  3. Full http(s) URL (legacy public) → return as-is
 */
export async function resolveImageUrl(image: string | { bucket: string; path: string }): Promise<string> {
    // Legacy: full public URL → pass through
    if (typeof image === 'string' && image.startsWith('http')) {
        return image
    }

    // Extract path
    const path = typeof image === 'string' ? image : image.path
    const bucket = typeof image === 'object' ? image.bucket : BUCKET

    // Check cache
    const cached = signedUrlCache.get(path)
    if (cached && cached.expiresAt > Date.now()) {
        return cached.url
    }

    // Generate signed URL
    const supabase = createClient()
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_TTL)

    if (error || !data?.signedUrl) {
        console.error('Failed to create signed URL', error)
        // Fallback: try public URL (legacy compat)
        if (typeof image === 'string' && image.startsWith('http')) return image
        return ''
    }

    // Cache it (expire 30s before actual TTL for safety)
    signedUrlCache.set(path, {
        url: data.signedUrl,
        expiresAt: Date.now() + (SIGNED_URL_TTL - 30) * 1000,
    })

    return data.signedUrl
}

/**
 * Resolve an array of image references to displayable URLs.
 * Handles mixed arrays of legacy URLs and new path objects.
 */
export async function resolveImageUrls(images: (string | { bucket: string; path: string })[]): Promise<string[]> {
    if (!images || images.length === 0) return []
    return Promise.all(images.map(resolveImageUrl))
}

/**
 * Upload an image to the private daily-logs bucket.
 * Returns the storage path (NOT a public URL).
 *
 * @param blob - The image blob to upload
 * @param pathPrefix - e.g. "{userId}/{dateKey}" or "memories/{userId}"
 * @returns The storage path string
 */
export async function uploadPrivateImage(
    blob: Blob,
    pathPrefix: string,
): Promise<string> {
    const supabase = createClient()
    const filename = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: false })

    if (error) throw error

    return filename // Store the path, NOT the public URL
}

/**
 * Resize an image on the client before upload.
 * Shared implementation to replace the per-page copies.
 */
export function resizeImage(file: File, maxSize = 1200): Promise<Blob> {
    return new Promise((resolve) => {
        const img = new Image()
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        img.onload = () => {
            let w = img.width, h = img.height
            if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize } }
            else { if (h > maxSize) { w = w * maxSize / h; h = maxSize } }
            canvas.width = w
            canvas.height = h
            ctx.drawImage(img, 0, 0, w, h)
            canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8)
        }
        img.src = URL.createObjectURL(file)
    })
}
