import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Terms of Service — The Two of Us',
    description: 'Terms of service for The Two of Us.',
}

export default function TermsPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-16">
            <Link
                href="/"
                className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to home
            </Link>

            <h1 className="text-3xl font-bold tracking-tight mb-8">Terms of Service</h1>

            <div className="prose prose-invert prose-zinc prose-sm max-w-none space-y-6 text-zinc-300 leading-relaxed">
                <p>
                    <strong>Last updated:</strong> June 2025
                </p>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Acceptance</h2>
                    <p>
                        By using The Two of Us, you agree to these terms. If you do not agree,
                        please do not use the service.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">The service</h2>
                    <p>
                        The Two of Us is a couples app that provides daily questions, shared
                        planning, memory keeping, and date ideas. The service is provided
                        &ldquo;as is&rdquo; and may change over time.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Accounts</h2>
                    <p>
                        You are responsible for maintaining the security of your account.
                        Each couple room is shared between exactly two people.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Content</h2>
                    <p>
                        You retain ownership of all content you create within the app.
                        By using date ideas features, you agree that ideas you mark as
                        public may be visible to other users.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Acceptable use</h2>
                    <p>
                        You agree not to misuse the service, attempt to access other users&apos;
                        data, or use the platform for any unlawful purpose.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Termination</h2>
                    <p>
                        You may delete your account at any time. We may also suspend or
                        terminate accounts that violate these terms.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Limitation of liability</h2>
                    <p>
                        The Two of Us is provided without warranty. We are not liable for any
                        damages arising from your use of the service.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-white">Changes</h2>
                    <p>
                        We may update these terms from time to time. Continued use of the
                        service after changes constitutes acceptance of the new terms.
                    </p>
                </section>
            </div>
        </main>
    )
}
