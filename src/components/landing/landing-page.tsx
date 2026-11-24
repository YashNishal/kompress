"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/workspace/primitives";
import { cn } from "@/lib/utils";
import { BarsFigure, FolderFigure, OfflineFigure, Specimen, SweepFigure } from "./figures";
import { useIntake } from "./intake";
import s from "./landing.module.css";
import { useScrollProgress } from "./scene";

type ChapterCopy = {
  id: string;
  label: string;
  title: string;
  body: string;
  /** Two figures under the text, as [value, caption]. */
  stats: [string, string][];
  figure: ReactNode;
};

const CHAPTERS: ChapterCopy[] = [
  {
    id: "folder",
    label: "Folders",
    title: "One drop. The whole folder.",
    body: "Drop a folder and every image and video in it joins the queue, subfolders included. Encoding starts straight away.",
    stats: [["24", "files from one drop"], ["0", "clicks before it starts"]],
    figure: <FolderFigure />,
  },
  {
    id: "bytes",
    label: "Formats",
    title: "Newer codecs, tinier files.",
    body: "AVIF, WebP and JPEG XL describe the same picture far more efficiently than PNG or JPEG. Pick a quality for images, or a target size for video.",
    stats: [["5", "image formats"], ["3", "video codecs"]],
    figure: <BarsFigure />,
  },
  {
    id: "check",
    label: "Compare",
    title: "Compare before you commit.",
    body: "Drag a divider across the original and the result, zoom down to single pixels, and read the SSIM score before you keep it.",
    stats: [["SSIM", "on every result"], ["1:1", "pixel zoom"]],
    figure: <SweepFigure />,
  },
  {
    id: "private",
    label: "Privacy",
    title: "Zero bytes uploaded.",
    body: "Everything runs inside this tab. There is no server to upload to and no account to make.",
    stats: [["0 B", "sent to a server"], ["0", "accounts to make"]],
    figure: <OfflineFigure />,
  },
];

const reveal = (d: number) => ({ "--d": d }) as CSSProperties;

/** The section crossing the middle of the viewport, or null above and below them. */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
          else setActive((a) => (a === e.target.id ? null : a));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const { id } of CHAPTERS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return active;
}

/**
 * The landing page: an intro, then four chapters whose figures play as you
 * scroll, then a drop zone. Files dropped anywhere go straight to the workspace.
 */
export function LandingPage() {
  const { over, dropProps, choose, input } = useIntake();
  const active = useActiveSection();

  return (
    <div {...dropProps}>
      <header className="sticky top-0 z-20 flex h-[52px] items-center justify-between gap-6 border-b border-hair bg-background/90 px-5 backdrop-blur sm:px-8">
        <Link href="/" aria-label="Kompress home">
          <Wordmark />
        </Link>
        <nav aria-label="Sections" className="hidden h-full items-stretch gap-6 text-[13px] md:flex">
          {CHAPTERS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? "location" : undefined}
              className={cn(
                "-mb-px flex items-center border-b-2 transition-colors",
                active === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </a>
          ))}
        </nav>
        <Link href="/app" className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
          Open workspace
        </Link>
      </header>

      <Intro choose={choose} />

      {CHAPTERS.map((c) => (
        <Chapter key={c.id} copy={c} />
      ))}

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <button
          type="button"
          onClick={choose}
          data-over={over ? "" : undefined}
          className={cn(
            s.drop,
            "relative flex min-h-[40dvh] w-full flex-col justify-end rounded-(--control-radius) p-6 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:p-10",
            over && "bg-acid text-acid-foreground",
          )}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <rect
              width="100%"
              height="100%"
              rx={5}
              fill="none"
              className={cn(s.ants, over ? "stroke-acid-foreground" : "stroke-foreground/30")}
              strokeWidth={1.5}
            />
          </svg>
          <span className="text-[clamp(36px,6vw,88px)] font-semibold leading-[0.95] tracking-[-0.04em]">
            {over ? "Let go." : "Drop your own files."}
          </span>
          <span className="mt-4 text-[15px] opacity-70">Or click to choose them.</span>
        </button>
      </section>

      <Footer />
      {input}
    </div>
  );
}

/** Counts from `from` to `to` (KB) once, in step with the specimen's arrow. */
function useCountDown(from: number, to: number, delay = 400, ms = 1200) {
  const [v, setV] = useState(from);
  useEffect(() => {
    // Under reduced motion, jump straight to the end on the first frame.
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const t = still ? 1 : Math.min(1, Math.max(0, (now - t0) / ms));
      const e = 1 - Math.pow(1 - t, 3);
      setV(from + (to - from) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay, ms]);
  return v;
}

const kb = (v: number) => (v >= 1000 ? `${(v / 1024).toFixed(2)} MB` : `${Math.round(v)} KB`);

/** The headline is the result; a receipt along the bottom of the fold does the maths. */
function Intro({ choose }: { choose: () => void }) {
  const after = useCountDown(3164, 187);
  const saved = Math.round((1 - after / 3164) * 100);
  const receipt: [string, string, boolean][] = [
    ["Before", "3.09 MB", false],
    ["After", kb(after), true],
    ["Saved", `${saved}%`, false],
    ["Uploaded", "0 bytes", false],
  ];

  return (
    <section className="grid min-h-[calc(100dvh-52px)] grid-rows-[minmax(0,1fr)_auto]">
      <div className="grid content-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
        <div>
          <p className="label-caps font-mono text-muted-foreground">IMG_0412.jpg · compressed in this tab</p>
          <h1 className="mt-6 text-[clamp(52px,9vw,144px)] font-semibold leading-[0.88] tracking-[-0.055em]">
            Same photo.
            <br />
            <span className="text-acid">94%</span> lighter.
          </h1>
          <p className="mt-8 max-w-[52ch] text-[17px] leading-relaxed text-muted-foreground">
            Kompress shrinks images and video right in your browser, with nothing to upload and nothing to install. Drop
            some files anywhere on this page to try it.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button variant="acid" className="h-10 rounded-(--control-radius) px-4 text-[14px]" onClick={choose}>
              Choose files
            </Button>
            <Button asChild variant="chrome" className="h-10 rounded-(--control-radius) px-4 text-[14px]">
              <Link href="/app">Open workspace</Link>
            </Button>
          </div>
        </div>

        <Specimen />
      </div>

      <dl className="grid grid-cols-2 border-t border-hair md:grid-cols-4">
        {receipt.map(([k, v, hot], i) => (
          <div
            key={k}
            className={cn("border-hair px-5 py-5 sm:px-8", i % 2 === 1 && "border-l", i > 1 && "border-t md:border-t-0", i === 2 && "md:border-l")}
          >
            <dt className="label-caps text-muted-foreground">{k}</dt>
            <dd className={cn("fig tnum mt-2 text-[clamp(22px,2.4vw,34px)] leading-none", hot && "text-acid")}>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Chapter({ copy: c }: { copy: ChapterCopy }) {
  const ref = useRef<HTMLElement>(null);
  useScrollProgress(ref);

  // Reveal the text once, when the chapter is well into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.in = "";
        io.disconnect();
      },
      { rootMargin: "0px 0px -35% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id={c.id} aria-labelledby={`${c.id}-title`} className={cn(s.chapter, "relative h-[230dvh] scroll-mt-[52px] border-t border-hair")}>
      <div className="sticky top-[52px] grid h-[calc(100dvh-52px)] grid-rows-[auto_minmax(0,1fr)] gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-1 lg:items-center lg:gap-12">
        <div className="max-w-[48ch]">
          <p className={cn(s.reveal, "label-caps font-mono text-muted-foreground")} style={reveal(0)}>
            {c.label}
          </p>
          <h2
            id={`${c.id}-title`}
            className={cn(s.reveal, "mt-5 text-balance text-[clamp(34px,4.2vw,64px)] font-semibold leading-[0.95] tracking-[-0.04em]")}
            style={reveal(0)}
          >
            {c.title}
          </h2>
          <p className={cn(s.reveal, "mt-5 text-[17px] leading-relaxed text-muted-foreground")} style={reveal(1)}>
            {c.body}
          </p>
          <div className={cn(s.reveal, "mt-8 hidden grid-cols-2 border-t border-hair sm:grid")} style={reveal(2)}>
            {c.stats.map(([v, k], j) => (
              <div key={k} className={cn("pt-5", j > 0 && "border-l border-hair pl-5")}>
                <p className="fig tnum text-[clamp(28px,3vw,44px)] leading-none">{v}</p>
                <p className="mt-2 text-[13px] text-muted-foreground">{k}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="min-h-0">{c.figure}</div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-hair px-5 py-8 text-[13px] text-muted-foreground sm:px-8">
      <Wordmark />
      <p>Your files never leave your device.</p>
    </footer>
  );
}
