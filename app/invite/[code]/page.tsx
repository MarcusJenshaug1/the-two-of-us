import type { Metadata } from 'next'
import InviteClient from './invite-client'

type Props = {
    params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { code } = await params

    return {
        title: `Join me on The Two of Us`,
        description: `Your partner invited you to their private space. Use code ${code} to connect.`,
        openGraph: {
            title: `💕 You've been invited to The Two of Us`,
            description: `Your partner wants to connect with you daily. Tap to join their private space.`,
            images: [
                {
                    url: '/og-image.png',
                    width: 1200,
                    height: 630,
                    alt: 'The Two of Us — couples daily question app',
                },
            ],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: `💕 You've been invited to The Two of Us`,
            description: `Your partner wants to connect with you daily. Tap to join their private space.`,
            images: ['/og-image.png'],
        },
    }
}

export default async function InvitePage({ params }: Props) {
    const { code } = await params
    return <InviteClient code={code} />
}
