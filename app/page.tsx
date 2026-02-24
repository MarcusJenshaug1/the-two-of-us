import type { Metadata } from 'next'
import { LandingContent } from './landing-content'

export const metadata: Metadata = {
    title: 'The Two of Us — Stay connected every day',
    description: 'Daily questions, shared plans, memories, and milestones for couples. 2 minutes a day to grow closer together.',
    openGraph: {
        title: 'The Two of Us — Stay connected every day',
        description: 'Daily questions, shared plans, memories, and milestones for couples.',
        url: '/',
        siteName: 'The Two of Us',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'The Two of Us' }],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'The Two of Us — Stay connected every day',
        description: 'Daily questions, shared plans, memories, and milestones for couples.',
        images: ['/og-image.png'],
    },
}

export default function LandingPage() {
    return <LandingContent />
}
