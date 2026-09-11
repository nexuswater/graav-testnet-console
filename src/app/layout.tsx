import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";
import "@/components/graav-x1/x1.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Launch and trade coins from a post, repost, or DM on X. Charts, portfolio, and account on graav.xyz. Your wallet signs every transaction.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://graav-testnet-console.vercel.app"),
  title: { default: "GRAAV", template: "%s · GRAAV" },
  description: DESCRIPTION,
  openGraph: {
    title: "GRAAV",
    description: DESCRIPTION,
    siteName: "GRAAV",
    images: [{ url: "/brand/graav-lockup.png", alt: "GRAAV" }],
  },
  twitter: {
    card: "summary",
    title: "GRAAV",
    description: DESCRIPTION,
    images: ["/brand/graav-lockup.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
