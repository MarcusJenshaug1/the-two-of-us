import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'The Two of Us',
        short_name: 'Two of Us',
        description: 'A private space for couples to connect, share, and grow together.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fbf6f1',
        theme_color: '#fbf6f1',
        icons: [
            {
                src: '/icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/icons/icon-maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
        shortcuts: [
            {
                name: 'Open Questions',
                url: '/app/questions',
                icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
            {
                name: 'Open Inbox',
                url: '/app/inbox',
                icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
            {
                name: 'Open Progress',
                url: '/app/progress',
                icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
        ],
    }
}
