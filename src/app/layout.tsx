import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEMES } from "@/lib/theme";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
