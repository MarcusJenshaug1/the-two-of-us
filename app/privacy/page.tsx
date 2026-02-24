import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Privacy Policy — The Two of Us',
    description: 'How we handle your data in The Two of Us.',
}

export default function PrivacyPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-16">
            <Link
                href="/"
                className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to home
            </Link>

            <h1 className="text-3xl font-bold tracking-tight mb-8">Privacy Policy</h1>

            <div className="prose prose-invert prose-zinc prose-sm max-w-none space-y-6 text-zinc-300 leading-relaxed">
                <p>
                    <strong>Last updated:</strong> June 2025
                </p>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">What we collect</h2>
                    <p>
                        When you create an account, we store your email address and the data you
                        choose to share within your couple room — answers to daily questions,
                        planner events, memories, and milestones.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">How we use it</h2>
                    <p>
                        Your data is used solely to power The Two of Us experience for you and
                        your partner. We do not sell, share, or monetise your personal data.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Data storage</h2>
                    <p>
                        All data is stored securely using Supabase infrastructure with
                        row-level security policies. Only you and your partner can access
                        your room&apos;s data.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Cookies</h2>
                    <p>
                        We use essential cookies for authentication. We do not use tracking
                        cookies or third-party analytics.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Your rights</h2>
                    <p>
                        You can request a copy of your data or ask for your account to be
                        deleted at any time by contacting us.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Contact</h2>
                    <p>
                        If you have any questions about this policy, please reach out through
                        the app settings or email us directly.
                    </p>
                </section>
            </div>
        </main>
    )
}
