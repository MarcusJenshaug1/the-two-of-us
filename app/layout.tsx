import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/supabase/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppUpdateNotifier } from "@/components/app-update-notifier";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { LocaleProvider } from "@/lib/i18n";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#fbf6f1" },
        { media: "(prefers-color-scheme: dark)", color: "#1f1411" },
    ],
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export const metadata: Metadata = {
    title: "The Two of Us",
    description: "A private space for couples to connect, share, and grow together.",
    metadataBase: new URL(
        process.env.NEXT_PUBLIC_SITE_URL || "https://two-of-us-iota.vercel.app"
    ),
    openGraph: {
        title: "The Two of Us",
        description: "A private space for couples to connect, share, and grow together.",
        url: "/",
        siteName: "The Two of Us",
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: "The Two of Us — couples daily question app",
            },
        ],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "The Two of Us",
        description: "A private space for couples to connect, share, and grow together.",
        images: ["/og-image.png"],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Two of Us",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.className} bg-background text-foreground antialiased min-h-screen flex flex-col`}>
                <LocaleProvider>
                    <AuthProvider>
                        <ToastProvider>
                            <ServiceWorkerRegister />
                            <AppUpdateNotifier />
                            {children}
                        </ToastProvider>
                    </AuthProvider>
                </LocaleProvider>
                <Analytics />
            </body>
        </html>
    );
}
