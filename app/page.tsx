import type { Metadata } from 'next'
import Link from 'next/link'
import {
    MessageCircle, CalendarDays, Star, Lightbulb, Shield,
    ChevronRight, Sparkles, Heart, ArrowRight,
    Check, HelpCircle, Download,
} from 'lucide-react'

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

/* ─── Data ─── */

const FEATURES = [
    {
        icon: MessageCircle,
        title: 'Daily Questions',
        desc: 'A new question every day to spark real conversations — from lighthearted to deep.',
    },
    {
        icon: CalendarDays,
        title: 'Shared Planner',
        desc: 'Events, tasks, and date plans in one place — so nothing falls through the cracks.',
    },
    {
        icon: Star,
        title: 'Memories & Milestones',
        desc: 'Save your favourite moments and mark the milestones that matter to you both.',
    },
    {
        icon: Lightbulb,
        title: 'Date Ideas',
        desc: 'Browse, save, and plan date ideas — or discover trending ones from other couples.',
    },
    {
        icon: Shield,
        title: 'Private & Secure',
        desc: 'Designed with privacy in mind. Your room is shared only with your partner.',
    },
]

const STEPS = [
    { num: '1', title: 'Create a room', desc: 'Sign up and create your private couple room in seconds.' },
    { num: '2', title: 'Invite your partner', desc: 'Share a simple invite link — they join with one tap.' },
    { num: '3', title: 'Start today', desc: "Answer today's question, plan something, save a memory." },
]

const OUTCOMES = [
    'Better conversations',
    'Fewer misunderstandings',
    'More quality time',
]

const MOCK_SCREENS = [
    {
        title: 'Answer today\'s question',
        emoji: '💬',
        mock: (
            <div className="space-y-2">
                <div className="h-2 w-3/4 rounded bg-rose-500/30" />
                <div className="h-2 w-1/2 rounded bg-zinc-700" />
                <div className="mt-3 flex gap-2">
                    <div className="h-8 flex-1 rounded-lg bg-zinc-800 border border-zinc-700" />
                    <div className="h-8 w-8 rounded-lg bg-rose-600" />
                </div>
            </div>
        ),
    },
    {
        title: 'Plan the week together',
        emoji: '📅',
        mock: (
            <div className="space-y-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-blue-400/40" />
                        <div className="h-2 flex-1 rounded bg-zinc-700" />
                    </div>
                ))}
            </div>
        ),
    },
    {
        title: 'Save moments as memories',
        emoji: '✨',
        mock: (
            <div className="grid grid-cols-2 gap-1.5">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="aspect-square rounded-lg bg-zinc-800 border border-zinc-700" />
                ))}
            </div>
        ),
    },
    {
        title: 'Pick a date idea',
        emoji: '💡',
        mock: (
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-amber-500/30 flex items-center justify-center text-[10px]">🍽️</div>
                    <div className="h-2 flex-1 rounded bg-zinc-700" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/30 flex items-center justify-center text-[10px]">🌿</div>
                    <div className="h-2 flex-1 rounded bg-zinc-700" />
                </div>
            </div>
        ),
    },
]

const TESTIMONIALS = [
    { quote: 'We finally talk about more than logistics.', emoji: '💕' },
    { quote: 'The daily question became our ritual.', emoji: '☀️' },
    { quote: 'Plans + memories in one place — simple.', emoji: '✨' },
]

const FAQ = [
    {
        q: 'Is it free?',
        a: 'The Two of Us is currently free to use while in beta. We may introduce optional premium features in the future.',
    },
    {
        q: 'Is it private?',
        a: 'Yes. Your room is shared only with your partner. We don\'t sell data or show ads.',
    },
    {
        q: 'Can we use it together?',
        a: 'Absolutely — it\'s built for two. Create a room, invite your partner, and everything is shared between you.',
    },
    {
        q: 'Do I need to install an app?',
        a: 'No app store needed. The Two of Us works in your browser, and you can install it as a PWA on your home screen for the best experience.',
    },
]

/* ─── Page ─── */

export default function LandingPage() {
    return (
        <>
            {/* Skip link */}
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-lg focus:bg-rose-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none"
            >
                Skip to content
            </a>

            {/* ═══ HEADER ═══ */}
            <header className="sticky top-0 z-50 w-full border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
                <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                    <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-tight">
                        <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
                        <span>The Two of Us</span>
                    </Link>

                    <div className="hidden items-center gap-6 text-sm text-zinc-400 sm:flex">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
                        <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                    </div>

                    <Link
                        href="/sign-in"
                        className="inline-flex h-9 items-center rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                    >
                        Get started
                    </Link>
                </nav>
            </header>

            {/* ═══ MAIN ═══ */}
            <main id="main" className="flex-1">

                {/* ── Hero ── */}
                <section className="relative overflow-hidden">
                    {/* Gradient glow */}
                    <div className="pointer-events-none absolute inset-0 -top-40 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(244,63,94,0.15),transparent)]" />

                    <div className="mx-auto max-w-5xl px-4 pb-20 pt-20 sm:pt-28 text-center relative">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400 mb-6">
                            <Sparkles className="h-3 w-3 text-rose-400" />
                            For couples who want more than &ldquo;how was your day?&rdquo;
                        </div>

                        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
                            Stay connected every day
                            <span className="text-rose-400"> — in 2&nbsp;minutes.</span>
                        </h1>

                        <p className="mx-auto mt-5 max-w-xl text-base text-zinc-400 sm:text-lg leading-relaxed">
                            Daily questions, shared plans, memories, and milestones for couples.
                            No noise — just the two of you.
                        </p>

                        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                            <Link
                                href="/sign-in"
                                className="inline-flex h-12 items-center justify-center rounded-xl bg-rose-600 px-8 text-base font-semibold text-white shadow-lg shadow-rose-600/20 transition-all hover:bg-rose-700 hover:shadow-rose-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                            >
                                Get started <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                            <a
                                href="#how-it-works"
                                className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 text-base font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                            >
                                See how it works
                            </a>
                        </div>

                        {/* Hero mock phone */}
                        <div className="mx-auto mt-14 max-w-xs">
                            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-3 shadow-2xl shadow-rose-500/5">
                                <div className="rounded-[1.4rem] border border-zinc-800 bg-zinc-950 p-5 space-y-4">
                                    {/* Mock question card */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Today&apos;s question</p>
                                        <p className="text-sm font-medium leading-snug">&ldquo;What&apos;s one thing I did this week that made you smile?&rdquo;</p>
                                    </div>
                                    <div className="h-px bg-zinc-800" />
                                    {/* Mock planner card */}
                                    <div className="flex items-center gap-2">
                                        <CalendarDays className="h-4 w-4 text-blue-400" />
                                        <div>
                                            <p className="text-xs font-medium">Date night</p>
                                            <p className="text-[10px] text-zinc-500">Saturday · 18:00</p>
                                        </div>
                                    </div>
                                    {/* Mock memory card */}
                                    <div className="flex items-center gap-2">
                                        <Star className="h-4 w-4 text-amber-400" />
                                        <div>
                                            <p className="text-xs font-medium">Weekend trip to Bergen</p>
                                            <p className="text-[10px] text-zinc-500">2 photos · Saved as memory</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Social proof ── */}
                <section className="border-y border-zinc-800/60 bg-zinc-900/30">
                    <div className="mx-auto max-w-5xl px-4 py-12">
                        <div className="grid gap-4 sm:grid-cols-3">
                            {TESTIMONIALS.map((t, i) => (
                                <figure key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 text-center">
                                    <span className="text-2xl">{t.emoji}</span>
                                    <blockquote className="mt-2 text-sm text-zinc-300 italic leading-relaxed">
                                        &ldquo;{t.quote}&rdquo;
                                    </blockquote>
                                </figure>
                            ))}
                        </div>
                        <p className="mt-6 text-center text-xs text-zinc-500">
                            Built to help couples create a shared rhythm.
                        </p>
                    </div>
                </section>

                {/* ── Features ── */}
                <section id="features" className="scroll-mt-20">
                    <div className="mx-auto max-w-5xl px-4 py-20">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                Everything you need,
                                <span className="text-rose-400"> nothing you don&apos;t.</span>
                            </h2>
                            <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto">
                                Simple tools to stay close — designed for busy couples who want to be intentional.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {FEATURES.map((f) => (
                                <div
                                    key={f.title}
                                    className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-3 transition-colors hover:border-rose-500/30"
                                >
                                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
                                        <f.icon className="h-5 w-5 text-rose-400" />
                                    </div>
                                    <h3 className="font-semibold">{f.title}</h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── How it works ── */}
                <section id="how-it-works" className="scroll-mt-20 border-y border-zinc-800/60 bg-zinc-900/20">
                    <div className="mx-auto max-w-5xl px-4 py-20">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                Up and running in
                                <span className="text-rose-400"> 60&nbsp;seconds.</span>
                            </h2>
                        </div>

                        <div className="grid gap-8 sm:grid-cols-3">
                            {STEPS.map((s) => (
                                <div key={s.num} className="text-center space-y-3">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-lg font-bold">
                                        {s.num}
                                    </div>
                                    <h3 className="font-semibold text-lg">{s.title}</h3>
                                    <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-10 text-center">
                            <Link
                                href="/sign-in"
                                className="inline-flex h-11 items-center rounded-xl bg-rose-600 px-8 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                            >
                                Get started — it&apos;s free <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── Outcomes ── */}
                <section className="mx-auto max-w-5xl px-4 py-20">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            What couples
                            <span className="text-rose-400"> actually get.</span>
                        </h2>
                    </div>

                    <div className="mx-auto max-w-md space-y-4">
                        {OUTCOMES.map((o) => (
                            <div key={o} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                                    <Check className="h-4 w-4 text-emerald-400" />
                                </div>
                                <span className="font-medium">{o}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Screenshots / demo ── */}
                <section className="border-y border-zinc-800/60 bg-zinc-900/20">
                    <div className="mx-auto max-w-5xl px-4 py-20">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                A peek
                                <span className="text-rose-400"> inside.</span>
                            </h2>
                            <p className="mt-3 text-sm text-zinc-400">
                                Here&apos;s what a day in The Two of Us looks like.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {MOCK_SCREENS.map((s) => (
                                <div key={s.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{s.emoji}</span>
                                        <p className="text-xs font-semibold text-zinc-300">{s.title}</p>
                                    </div>
                                    <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4">
                                        {s.mock}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── PWA Install ── */}
                <section className="mx-auto max-w-5xl px-4 py-20">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center sm:p-12">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10">
                            <Download className="h-7 w-7 text-rose-400" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            Install it like an app.
                        </h2>
                        <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400 leading-relaxed">
                            No app store needed. Add The Two of Us to your home screen for the full experience — instant access, notifications, and more.
                        </p>
                        <div className="mt-6">
                            <Link
                                href="/sign-in"
                                className="inline-flex h-11 items-center rounded-xl bg-rose-600 px-8 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                            >
                                Get started <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── FAQ ── */}
                <section id="faq" className="scroll-mt-20 border-t border-zinc-800/60 bg-zinc-900/20">
                    <div className="mx-auto max-w-2xl px-4 py-20">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                Questions
                                <span className="text-rose-400"> &amp; answers.</span>
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {FAQ.map((f) => (
                                <details
                                    key={f.q}
                                    className="group rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"
                                >
                                    <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold transition-colors hover:text-rose-400 [&::-webkit-details-marker]:hidden list-none">
                                        <span className="flex items-center gap-2">
                                            <HelpCircle className="h-4 w-4 text-zinc-500 group-open:text-rose-400 transition-colors" />
                                            {f.q}
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-90" />
                                    </summary>
                                    <div className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">
                                        {f.a}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

            </main>

            {/* ═══ FOOTER ═══ */}
            <footer className="border-t border-zinc-800/60">
                <div className="mx-auto max-w-5xl px-4 py-10">
                    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
                            <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
                            The Two of Us
                        </div>

                        <div className="flex items-center gap-6 text-sm text-zinc-500">
                            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                        </div>
                    </div>

                    <p className="mt-6 text-center text-xs text-zinc-600">
                        © {new Date().getFullYear()} The Two of Us. Made with love.
                    </p>
                </div>
            </footer>
        </>
    )
}
