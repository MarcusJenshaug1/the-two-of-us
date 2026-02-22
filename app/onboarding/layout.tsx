export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950">
            <div className="w-full max-w-sm space-y-8">
                {children}
            </div>
        </div>
    )
}
