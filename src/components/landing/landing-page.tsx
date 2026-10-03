"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/workspace/primitives";
import { cn } from "@/lib/utils";
import { BarsFigure, FolderFigure, OfflineFigure, SweepFigure } from "./figures";
import { useIntake } from "./intake";
import s from "./landing.module.css";
import { useScrollProgress } from "./scene";

const SECTIONS = [
  { id: "folder", label: "Folders" },
  { id: "bytes", label: "Formats" },
  { id: "check", label: "Compare" },
  { id: "private", label: "Privacy" },
];

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
    for (const { id } of SECTIONS) {
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
          {SECTIONS.map(({ id, label }) => (
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

      <Chapter
        id="folder"
        title="Bring the whole folder."
        body="Drop a folder and every image and video in it joins the queue, subfolders included. Encoding starts straight away."
        figure={<FolderFigure />}
      />
      <Chapter
        id="bytes"
        title="Same pixels, far fewer bytes."
        body="AVIF, WebP and JPEG XL describe the same picture far more efficiently than PNG or JPEG. Pick a quality for images, or a target size for video."
        figure={<BarsFigure />}
      />
      <Chapter
        id="check"
        title="Check it before you trust it."
        body="Drag a divider across the original and the result, and zoom in as close as you like before you keep it."
        figure={<SweepFigure />}
      />
      <Chapter
        id="private"
        title="Nothing leaves your laptop."
        body="Everything runs inside this tab. There is no server to upload to and no account to make."
        figure={<OfflineFigure />}
      />

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

function Intro({ choose }: { choose: () => void }) {
  return (
    <section className="grid min-h-[calc(100dvh-52px)] content-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
      <div>
        <h1 className="text-[clamp(48px,8.4vw,132px)] font-semibold leading-[0.9] tracking-[-0.05em]">
          A 3 MB photo,
          <br />
          <span className="text-acid">187 KB</span> later.
        </h1>
        <p className="mt-8 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
          Kompress compresses images and video right in your browser. Drop some files anywhere on this page to try
          it.
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
    </section>
  );
}

/** A specimen pinned to the page: before, a drawn arrow, after. */
function Specimen() {
  return (
    <svg viewBox="0 0 420 300" className="w-full max-w-[460px] lg:justify-self-end" role="img" aria-label="A 3 MB photo becomes a 187 KB one.">
      <g transform="rotate(-3 110 120)">
        <rect x={20} y={30} width={180} height={150} rx={4} className="fill-card stroke-foreground" strokeWidth={2} />
        <rect x={32} y={42} width={156} height={100} fill="#e07a5f" />
        <rect x={32} y={42} width={156} height={40} fill="#1b2a4a" />
        <circle cx={140} cy={92} r={14} fill="#fff4d6" />
        <path d="M32 120 Q 80 96 120 116 T 188 110 V142 H32 Z" fill="#3d405b" />
        <text x={32} y={164} fontSize={14} className="fill-foreground">
          3.09 MB
        </text>
      </g>
      <path d="M150 196 C 170 262, 250 270, 292 214" pathLength={1} className={cn(s.draw, "fill-none stroke-acid")} strokeWidth={3} strokeLinecap="round" />
      <path d="M280 214 l13 -2 l2 13" pathLength={1} className={cn(s.draw, "fill-none stroke-acid")} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <g className={s.pop}>
        <g transform="rotate(4 330 130)">
          <rect x={262} y={86} width={130} height={108} rx={4} className="fill-card stroke-foreground" strokeWidth={2} />
          <rect x={271} y={95} width={112} height={72} fill="#e07a5f" />
          <rect x={271} y={95} width={112} height={29} fill="#1b2a4a" />
          <circle cx={348} cy={131} r={10} fill="#fff4d6" />
          <path d="M271 152 Q 305 134 334 148 T 383 144 V167 H271 Z" fill="#3d405b" />
          <text x={271} y={184} fontSize={13} className="fill-foreground">
            187 KB
          </text>
        </g>
      </g>
    </svg>
  );
}

function Chapter({ id, title, body, figure }: { id: string; title: string; body: string; figure: ReactNode }) {
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
    <section ref={ref} id={id} aria-labelledby={`${id}-title`} className={cn(s.chapter, "relative h-[230dvh] scroll-mt-[52px] border-t border-hair")}>
      <div className="sticky top-[52px] grid h-[calc(100dvh-52px)] grid-rows-[auto_minmax(0,1fr)] gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-1 lg:items-center lg:gap-12">
        <div className="max-w-[44ch]">
          <h2 id={`${id}-title`} className={cn(s.reveal, "text-[clamp(30px,3.6vw,52px)] font-semibold leading-[1] tracking-[-0.035em]")}>
            {title}
          </h2>
          <p className={cn(s.reveal, "mt-4 text-[16px] leading-relaxed text-muted-foreground")} style={{ "--d": 1 } as React.CSSProperties}>
            {body}
          </p>
        </div>
        <div className="min-h-0">{figure}</div>
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
