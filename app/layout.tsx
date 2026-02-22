import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/supabase/auth-provider";
import { QueryProvider } from "@/components/query-provider";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
    themeColor: "#09090b", // zinc-950
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export const metadata: Metadata = {
    title: "The Two of Us",
    description: "A private space for couples to connect, share, and grow together.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "Two of Us",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.className} bg-zinc-950 text-zinc-50 antialiased min-h-screen flex flex-col`}>
                <AuthProvider>
                    <QueryProvider>
                        {children}
                    </QueryProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
