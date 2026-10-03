import Link from "next/link";
import { HeroDrop } from "@/components/landing/hero-drop";
import { Wordmark } from "@/components/workspace/primitives";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[44px] shrink-0 items-center justify-between border-b border-hair bg-chrome px-4 text-chrome-foreground">
        <Wordmark />
        <Link href="/app" className="text-[13px] font-medium text-chrome-muted transition-colors hover:text-chrome-foreground">
          Open workspace →
        </Link>
      </header>

      <main className="grid flex-1 grid-cols-1 border-b border-rule lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="flex flex-col justify-end border-b border-hair p-6 sm:p-10 lg:border-b-0 lg:border-r">
          <span className="label-caps text-muted-foreground">Image &amp; video optimiser · runs in your browser</span>
          <h1 className="mt-5 text-[clamp(52px,8vw,128px)] font-semibold leading-[0.95] tracking-[-0.045em]">
            Smaller files.
            <br />
            <span className="text-acid">Same pixels.</span>
          </h1>
          <p className="mt-7 max-w-lg text-[16px] font-medium leading-relaxed text-muted-foreground">
            Batch-compress hundreds of images to AVIF, WebP, JPEG XL or PNG, and shrink videos to a target size. Everything is
            encoded on your device. Nothing is uploaded, ever.
          </p>
        </section>
        <HeroDrop />
      </main>

      <footer className="grid grid-cols-2 text-[12px] font-medium text-muted-foreground sm:grid-cols-4">
        {[
          ["01", "No uploads, no accounts"],
          ["02", "AVIF, WebP and JPEG XL"],
          ["03", "Hundreds of files at once"],
          ["04", "Video to a target size"],
        ].map(([n, t]) => (
          <div key={n} className="border-r border-hair px-4 py-4 last:border-r-0">
            <span className="mr-2 tnum">{n}</span>
            <span className="text-foreground">{t}</span>
          </div>
        ))}
      </footer>
    </div>
  );
}
