'use client'

import { useState, useEffect, memo } from 'react'
import { resolveImageUrl } from '@/lib/storage'

interface SignedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    /** Storage path OR legacy http URL */
    path: string
}

/**
 * Drop-in <img> replacement that resolves private storage paths
 * to signed URLs. Legacy full http(s) URLs pass through unchanged.
 */
export const SignedImage = memo(function SignedImage({ path, ...props }: SignedImageProps) {
    const [src, setSrc] = useState(() => (path.startsWith('http') ? path : ''))

    useEffect(() => {
        if (path.startsWith('http')) {
            setSrc(path)
            return
        }
        let cancelled = false
        resolveImageUrl(path).then((url) => {
            if (!cancelled) setSrc(url)
        })
        return () => { cancelled = true }
    }, [path])

    if (!src) {
        // Placeholder while loading signed URL
        return <div className={props.className} style={{ background: '#27272a' }} />
    }

    return <img {...props} src={src} />
})

/**
 * Hook that resolves a single image path to a displayable URL.
 * Returns null while loading.
 */
export function useSignedUrl(path: string | null): string | null {
    const [url, setUrl] = useState<string | null>(() =>
        path && path.startsWith('http') ? path : null,
    )

    useEffect(() => {
        if (!path) { setUrl(null); return }
        if (path.startsWith('http')) { setUrl(path); return }
        let cancelled = false
        resolveImageUrl(path).then((resolved) => {
            if (!cancelled) setUrl(resolved)
        })
        return () => { cancelled = true }
    }, [path])

    return url
}
