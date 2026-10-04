import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEMES } from "@/lib/theme";
import "./globals.css";

// Self-hosted (latin subset from Google Fonts) so builds never hit the network;
// next/font/google fetches at build time and can stall the compile indefinitely.
const plexSans = localFont({
  variable: "--font-plex-sans",
  src: [
    { path: "./fonts/plex-sans-400.woff2", weight: "400" },
    { path: "./fonts/plex-sans-500.woff2", weight: "500" },
    { path: "./fonts/plex-sans-600.woff2", weight: "600" },
    { path: "./fonts/plex-sans-700.woff2", weight: "700" },
  ],
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "./fonts/plex-mono-400.woff2", weight: "400" },
    { path: "./fonts/plex-mono-500.woff2", weight: "500" },
  ],
  fallback: ["ui-monospace", "monospace"],
});

const description =
  "Batch-compress images to AVIF, WebP, JPEG XL and more, and shrink videos to a target size. Everything runs locally; nothing is uploaded.";

export const metadata: Metadata = {
  // Absolute URLs for the social images. Without it Next uses localhost in dev and the Vercel production URL when deployed.
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  applicationName: "Kompress",
  title: {
    default: "Kompress: compress images and video in your browser",
    template: "%s · Kompress",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "Kompress",
    title: "Kompress: smaller files, same pixels",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Kompress: smaller files, same pixels",
    description,
  },
  appleWebApp: { title: "Kompress", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f1ee" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/* Extensions (e.g. ColorZilla) stamp attributes on <body> before hydration. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" themes={[...THEMES]} defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
