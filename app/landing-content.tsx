'use client'

import Link from 'next/link'
import {
    MessageCircle, CalendarDays, Star, Lightbulb, Shield,
    ChevronRight, Sparkles, Heart, ArrowRight,
    Check, HelpCircle, Download, Globe,
} from 'lucide-react'
import { useTranslations, useLocale } from '@/lib/i18n'

/* ─── Page ─── */

export function LandingContent() {
    const t = useTranslations('landing')
    const { locale, setLocale } = useLocale()

    const FEATURES = [
        { icon: MessageCircle, titleKey: 'featureDailyQTitle', descKey: 'featureDailyQDesc' },
        { icon: CalendarDays, titleKey: 'featurePlannerTitle', descKey: 'featurePlannerDesc' },
        { icon: Star, titleKey: 'featureMemoriesTitle', descKey: 'featureMemoriesDesc' },
        { icon: Lightbulb, titleKey: 'featureDateIdeasTitle', descKey: 'featureDateIdeasDesc' },
        { icon: Shield, titleKey: 'featurePrivacyTitle', descKey: 'featurePrivacyDesc' },
    ]

    const STEPS = [
        { num: '1', titleKey: 'step1Title', descKey: 'step1Desc' },
        { num: '2', titleKey: 'step2Title', descKey: 'step2Desc' },
        { num: '3', titleKey: 'step3Title', descKey: 'step3Desc' },
    ]

    const OUTCOMES = [
        t('outcome1'),
        t('outcome2'),
        t('outcome3'),
    ]

    const MOCK_SCREENS = [
        {
            titleKey: 'mockQuestion',
            emoji: '💬',
            mock: (
                <div className="space-y-2">
                    <div className="h-2 w-3/4 rounded bg-rose-300" />
                    <div className="h-2 w-1/2 rounded bg-muted" />
                    <div className="mt-3 flex gap-2">
                        <div className="h-8 flex-1 rounded-lg bg-secondary border border-border" />
                        <div className="h-8 w-8 rounded-lg bg-primary" />
                    </div>
                </div>
            ),
        },
        {
            titleKey: 'mockPlanner',
            emoji: '📅',
            mock: (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-rose-300" />
                            <div className="h-2 flex-1 rounded bg-muted" />
                        </div>
                    ))}
                </div>
            ),
        },
        {
            titleKey: 'mockMemories',
            emoji: '✨',
            mock: (
                <div className="grid grid-cols-2 gap-1.5">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="aspect-square rounded-lg bg-secondary border border-border" />
                    ))}
                </div>
            ),
        },
        {
            titleKey: 'mockDateIdea',
            emoji: '💡',
            mock: (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-warning/30 flex items-center justify-center text-[10px]">🍽️</div>
                        <div className="h-2 flex-1 rounded bg-muted" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-success/30 flex items-center justify-center text-[10px]">🌿</div>
                        <div className="h-2 flex-1 rounded bg-muted" />
                    </div>
                </div>
            ),
        },
    ]

    const TESTIMONIALS = [
        { key: 'testimonial1', emoji: '💕' },
        { key: 'testimonial2', emoji: '☀️' },
        { key: 'testimonial3', emoji: '✨' },
    ]

    const FAQ = [
        { qKey: 'faq1q', aKey: 'faq1a' },
        { qKey: 'faq2q', aKey: 'faq2a' },
        { qKey: 'faq3q', aKey: 'faq3a' },
        { qKey: 'faq4q', aKey: 'faq4a' },
    ]

    return (
        <>
            {/* Skip link */}
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
            >
                {t('skipToContent')}
            </a>


            {/* ═══ HEADER ═══ */}
            <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl">
                <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                    <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-tight">
                        <Heart className="h-5 w-5 text-primary fill-rose-500" />
                        <span>The Two of Us</span>
                    </Link>

                    <div className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
                        <a href="#features" className="hover:text-foreground transition-colors">{t('features')}</a>
                        <a href="#how-it-works" className="hover:text-foreground transition-colors">{t('howItWorks')}</a>
                        <a href="#faq" className="hover:text-foreground transition-colors">{t('faq')}</a>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Language toggle */}
                        <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-0.5">
                            <button
                                onClick={() => setLocale('en')}
                                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${locale === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setLocale('no')}
                                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${locale === 'no' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                NO
                            </button>
                        </div>

                        <Link
                            href="/sign-in"
                            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            {t('getStarted')}
                        </Link>
                    </div>
                </nav>
            </header>

            {/* ═══ MAIN ═══ */}
            <main id="main" className="flex-1">

                {/* ── Hero ── */}
                <section className="relative overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 -top-40 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(168,82,106,0.18),transparent)]" />

                    <div className="mx-auto max-w-5xl px-4 pb-20 pt-20 sm:pt-28 text-center relative">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground mb-6">
                            <Sparkles className="h-3 w-3 text-primary" />
                            {t('heroTagline')}
                        </div>

                        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl text-foreground">
                            {t('heroTitle')}
                            <span className="text-primary"> {t('heroTitleAccent')}</span>
                        </h1>

                        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg leading-relaxed">
                            {t('heroDesc')}
                        </p>

                        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                            <Link
                                href="/sign-in"
                                className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-rose-600/15 transition-all hover:bg-rose-700 hover:shadow-rose-600/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                {t('getStarted')} <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                            <a
                                href="#how-it-works"
                                className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card/70 px-6 text-base font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                {t('seeHowItWorks')}
                            </a>
                        </div>

                        {/* Hero mock phone */}
                        <div className="mx-auto mt-14 max-w-xs">
                            <div className="rounded-[2rem] border border-border bg-card p-3 shadow-2xl shadow-rose-600/10">
                                <div className="rounded-[1.4rem] border border-border bg-background p-5 space-y-4">
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{t('todaysQuestion')}</p>
                                        <p className="text-sm font-medium leading-snug text-foreground">&ldquo;{t('mockQuestionSample')}&rdquo;</p>
                                    </div>
                                    <div className="h-px bg-border" />
                                    <div className="flex items-center gap-2">
                                        <CalendarDays className="h-4 w-4 text-primary" />
                                        <div>
                                            <p className="text-xs font-medium text-foreground">{t('dateNight')}</p>
                                            <p className="text-[10px] text-muted-foreground">{t('saturdayTime')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Star className="h-4 w-4 text-warning" />
                                        <div>
                                            <p className="text-xs font-medium text-foreground">{t('weekendTrip')}</p>
                                            <p className="text-[10px] text-muted-foreground">{t('photosSavedAsMemory')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Social proof ── */}
                <section className="border-y border-border/70 bg-card/40">
                    <div className="mx-auto max-w-5xl px-4 py-12">
                        <div className="grid gap-4 sm:grid-cols-3">
                            {TESTIMONIALS.map((item, i) => (
                                <figure key={i} className="rounded-xl border border-border bg-card/70 p-5 text-center">
                                    <span className="text-2xl">{item.emoji}</span>
                                    <blockquote className="mt-2 text-sm text-foreground/80 italic leading-relaxed">
                                        &ldquo;{t(item.key)}&rdquo;
                                    </blockquote>
                                </figure>
                            ))}
                        </div>
                        <p className="mt-6 text-center text-xs text-muted-foreground">
                            {t('socialProof')}
                        </p>
                    </div>
                </section>

                {/* ── Features ── */}
                <section id="features" className="scroll-mt-20">
                    <div className="mx-auto max-w-5xl px-4 py-20">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
                                {t('featuresTitle')}
                                <span className="text-primary"> {t('featuresTitleAccent')}</span>
                            </h2>
                            <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
                                {t('featuresSubtitle')}
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {FEATURES.map((f) => (
                                <div
                                    key={f.titleKey}
                                    className="rounded-2xl border border-border bg-card/60 p-6 space-y-3 transition-colors hover:border-rose-300"
                                >
                                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                                        <f.icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-foreground">{t(f.titleKey)}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── How it works ── */}
                <section id="how-it-works" className="scroll-mt-20 border-y border-border/70 bg-card/30">
                    <div className="mx-auto max-w-5xl px-4 py-20">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
                                {t('howItWorksTitle')}
                                <span className="text-primary"> {t('howItWorksTitleAccent')}</span>
                            </h2>
                        </div>

                        <div className="grid gap-8 sm:grid-cols-3">
                            {STEPS.map((s) => (
                                <div key={s.num} className="text-center space-y-3">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                                        {s.num}
                                    </div>
                                    <h3 className="font-semibold text-lg text-foreground">{t(s.titleKey)}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{t(s.descKey)}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-10 text-center">
                            <Link
                                href="/sign-in"
                                className="inline-flex h-11 items-center rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                {t('getStartedFree')} <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── Outcomes ── */}
                <section className="mx-auto max-w-5xl px-4 py-20">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
                            {t('outcomesTitle')}
                            <span className="text-primary"> {t('outcomesTitleAccent')}</span>
                        </h2>
                    </div>

                    <div className="mx-auto max-w-md space-y-4">
                        {OUTCOMES.map((o) => (
                            <div key={o} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-5 py-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15">
                                    <Check className="h-4 w-4 text-success" />
                                </div>
                                <span className="font-medium text-foreground">{o}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Screenshots / demo ── */}
                <section className="border-y border-border/70 bg-card/30">
                    <div className="mx-auto max-w-5xl px-4 py-20">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
                                {t('peekTitle')}
                                <span className="text-primary"> {t('peekTitleAccent')}</span>
                            </h2>
                            <p className="mt-3 text-sm text-muted-foreground">
                                {t('peekSubtitle')}
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {MOCK_SCREENS.map((s) => (
                                <div key={s.titleKey} className="rounded-2xl border border-border bg-card/70 p-5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{s.emoji}</span>
                                        <p className="text-xs font-semibold text-foreground">{t(s.titleKey)}</p>
                                    </div>
                                    <div className="rounded-xl bg-background border border-border p-4">
                                        {s.mock}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── PWA Install ── */}
                <section className="mx-auto max-w-5xl px-4 py-20">
                    <div className="rounded-2xl border border-border bg-card/60 p-8 text-center sm:p-12">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
                            <Download className="h-7 w-7 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                            {t('installTitle')}
                        </h2>
                        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
                            {t('installDesc')}
                        </p>
                        <div className="mt-6">
                            <Link
                                href="/sign-in"
                                className="inline-flex h-11 items-center rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                {t('getStarted')} <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── FAQ ── */}
                <section id="faq" className="scroll-mt-20 border-t border-border/70 bg-card/30">
                    <div className="mx-auto max-w-2xl px-4 py-20">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
                                {t('faqTitle')}
                                <span className="text-primary"> {t('faqTitleAccent')}</span>
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {FAQ.map((f) => (
                                <details
                                    key={f.qKey}
                                    className="group rounded-xl border border-border bg-card/60 overflow-hidden"
                                >
                                    <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold transition-colors hover:text-primary [&::-webkit-details-marker]:hidden list-none">
                                        <span className="flex items-center gap-2">
                                            <HelpCircle className="h-4 w-4 text-muted-foreground group-open:text-primary transition-colors" />
                                            {t(f.qKey)}
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                                    </summary>
                                    <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                                        {t(f.aKey)}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

            </main>

            {/* ═══ FOOTER ═══ */}
            <footer className="border-t border-border/70">
                <div className="mx-auto max-w-5xl px-4 py-10">
                    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
                            <Heart className="h-4 w-4 text-primary fill-rose-500" />
                            The Two of Us
                        </div>

                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <Link href="/privacy" className="hover:text-foreground transition-colors">{t('privacy')}</Link>
                            <Link href="/terms" className="hover:text-foreground transition-colors">{t('terms')}</Link>
                            <a href="#faq" className="hover:text-foreground transition-colors">{t('faq')}</a>
                        </div>
                    </div>

                    <p className="mt-6 text-center text-xs text-muted-foreground">
                        © {new Date().getFullYear()} The Two of Us. {t('madeWith')}
                    </p>
                </div>
            </footer>
        </>
    )
}
