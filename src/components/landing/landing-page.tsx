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

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const size = (mb: number) => (mb >= 1 ? `${mb.toFixed(2)} MB` : `${Math.round(mb * 1000)} KB`);

const CHAPTERS = [
  { id: "folder", short: "Folders" },
  { id: "bytes", short: "Bytes" },
  { id: "check", short: "Check" },
  { id: "private", short: "Private" },
];

/** Write text only when it changes; these run on every scroll frame. */
function set(el: HTMLElement | null, text: string) {
  if (el && el.textContent !== text) el.textContent = text;
}

/**
 * The landing page: an intro, then four chapters whose figures play as you
 * scroll, then a drop zone. Files dropped anywhere go straight to the workspace.
 */
export function LandingPage() {
  const { over, dropProps, choose, input } = useIntake();
  const [active, setActive] = useState(-1);
  const queued = useRef<HTMLSpanElement>(null);
  const encoded = useRef<HTMLSpanElement>(null);
  const out = useRef<HTMLSpanElement>(null);
  const saved = useRef<HTMLSpanElement>(null);
  const ssim = useRef<HTMLSpanElement>(null);

  // The chapter whose pinned figure is on screen; -1 for the intro and the end.
  const track = (i: number) => (p: number) => {
    if (p > 0 && p < 1) setActive(i);
    else if ((i === 0 && p === 0) || (i === CHAPTERS.length - 1 && p === 1)) setActive((a) => (a === i ? -1 : a));
  };

  return (
    <div {...dropProps}>
      <header className="sticky top-0 z-20 flex h-[52px] items-center gap-6 border-b border-hair bg-background/90 px-5 backdrop-blur sm:px-8">
        <Link href="/" aria-label="Kompress home">
          <Wordmark />
        </Link>
        <nav aria-label="Chapters" className="mx-auto hidden items-center gap-1 font-mono text-[12px] md:flex">
          {CHAPTERS.map((c, i) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              aria-current={active === i ? "step" : undefined}
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                active === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {String(i + 1).padStart(2, "0")} {c.short}
            </a>
          ))}
        </nav>
        <Link href="/app" className="ml-auto text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground md:ml-0">
          Open workspace →
        </Link>
      </header>

      <Intro choose={choose} />

      <Chapter
        id="folder"
        n={1}
        title="Bring the whole folder."
        body="Drop a folder and every image and video in it joins the queue, subfolders included. Encoding starts straight away, several files at a time."
        stat={
          <>
            <span ref={queued}>0</span> queued · <span ref={encoded}>0</span> encoded
          </>
        }
        finalStat="24 files queued and encoded"
        onProgress={(p) => {
          track(0)(p);
          let q = 0;
          let e = 0;
          for (let i = 0; i < 24; i++) {
            if (p >= 0.25 + i * 0.022) q++;
            if (p >= 0.67 + i * 0.012) e++;
          }
          set(queued.current, String(q));
          set(encoded.current, String(e));
        }}
        figure={<FolderFigure />}
      />
      <Chapter
        id="bytes"
        n={2}
        title="Same pixels, far fewer bytes."
        body="AVIF, WebP and JPEG XL describe the same picture far more efficiently than PNG or JPEG. Pick a quality for images, or a target size for video."
        stat={
          <>
            9.54 MB → <span ref={out}>9.54 MB</span> <span ref={saved} className="text-ok" />
          </>
        }
        finalStat="9.54 MB down to 827 KB, 91% smaller"
        onProgress={(p) => {
          track(1)(p);
          const t = ease(clamp01((p - 0.12) / 0.7));
          set(out.current, size(9.54 - (9.54 - 0.827) * t));
          set(saved.current, t > 0.02 ? `−${Math.round(91 * t)}%` : "");
        }}
        figure={<BarsFigure />}
      />
      <Chapter
        id="check"
        n={3}
        title="Check it before you trust it."
        body="Compare drags a divider across the original and the result, zooms to 8× so you can inspect single pixels, and scores how alike they are. 1.000 would be identical."
        stat={
          <>
            SSIM <span ref={ssim}>0.000</span>
          </>
        }
        finalStat="SSIM 0.978"
        onProgress={(p) => {
          track(2)(p);
          set(ssim.current, (0.9779 * ease(clamp01((p - 0.1) / 0.7))).toFixed(3));
        }}
        figure={<SweepFigure />}
      />
      <Chapter
        id="private"
        n={4}
        title="Nothing leaves your laptop."
        body="The encoders run as WebAssembly inside this tab. There is no server to upload to and no account to make. Your files stay on your device."
        stat={<>0 bytes uploaded</>}
        onProgress={track(3)}
        figure={<OfflineFigure />}
      />

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <p className="label-caps text-muted-foreground">05 · Your turn</p>
        <button
          type="button"
          onClick={choose}
          data-over={over ? "" : undefined}
          className={cn(
            s.drop,
            "relative mt-4 flex min-h-[46dvh] w-full flex-col justify-end rounded-(--control-radius) p-6 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:p-10",
            over && "bg-acid text-acid-foreground",
          )}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <rect
              width="100%"
              height="100%"
              rx={5}
              fill="none"
              className={cn(s.ants, over ? "stroke-acid-foreground" : "stroke-foreground/40")}
              strokeWidth={2}
            />
          </svg>
          <span className="text-[clamp(40px,7vw,104px)] font-semibold leading-[0.95] tracking-[-0.045em]">
            {over ? "Let go." : "Drop your own files."}
          </span>
          <span className="mt-4 font-mono text-[13px] opacity-70">
            or click to choose · images and video · they never leave this tab
          </span>
        </button>
      </section>

      <Footer />
      {input}
    </div>
  );
}

function Intro({ choose }: { choose: () => void }) {
  return (
    <section className="relative grid min-h-[calc(100dvh-52px)] content-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
      <div>
        <p className="font-mono text-[12px] text-muted-foreground">Image and video compression · runs in your browser</p>
        <h1 className="mt-6 text-[clamp(48px,8.4vw,132px)] font-semibold leading-[0.9] tracking-[-0.05em]">
          A 3 MB photo,
          <br />
          <span className="text-acid">187 KB</span> later.
        </h1>
        <p className="mt-8 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
          Kompress batch-compresses images and video on your own device. Scroll for how it works, or drop some files
          anywhere on this page to try it.
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

      <a
        href="#folder"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground sm:flex"
      >
        How it works
        <span className="relative h-8 w-px overflow-hidden bg-hair">
          <span className={cn(s.cue, "absolute inset-0 bg-foreground")} />
        </span>
      </a>
    </section>
  );
}

/** A specimen pinned to the page: before, a drawn arrow, after. */
function Specimen() {
  return (
    <svg viewBox="0 0 420 300" className="w-full max-w-[460px] lg:justify-self-end" role="img" aria-label="dusk.png, 3.09 MB, becomes dusk.avif, 187 KB.">
      <g transform="rotate(-3 110 120)">
        <rect x={20} y={30} width={180} height={150} rx={4} className="fill-card stroke-foreground" strokeWidth={2} />
        <rect x={32} y={42} width={156} height={100} fill="#e07a5f" />
        <rect x={32} y={42} width={156} height={40} fill="#1b2a4a" />
        <circle cx={140} cy={92} r={14} fill="#fff4d6" />
        <path d="M32 120 Q 80 96 120 116 T 188 110 V142 H32 Z" fill="#3d405b" />
        <text x={32} y={164} fontSize={13} className="fill-foreground font-mono">
          dusk.png · 3.09 MB
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
          <text x={271} y={184} fontSize={11.5} className="fill-foreground font-mono">
            .avif · 187 KB
          </text>
        </g>
      </g>
    </svg>
  );
}

function Chapter({
  id,
  n,
  title,
  body,
  stat,
  finalStat,
  figure,
  onProgress,
}: {
  id: string;
  n: number;
  title: string;
  body: string;
  stat: ReactNode;
  /** What a screen reader hears instead of the ticking counter. */
  finalStat?: string;
  figure: ReactNode;
  onProgress?: (p: number) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useScrollProgress(ref, onProgress);

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
        <div className="absolute inset-x-0 top-0 h-[2px] bg-hair">
          <div className={cn(s.rail, "h-full bg-acid")} />
        </div>
        <div className="max-w-[46ch]">
          <p className={cn(s.reveal, "font-mono text-[12px] text-muted-foreground")}>{String(n).padStart(2, "0")} / 04</p>
          <h2 id={`${id}-title`} className={cn(s.reveal, "mt-3 text-[clamp(30px,3.6vw,52px)] font-semibold leading-[1] tracking-[-0.035em]")} style={{ "--d": 1 } as React.CSSProperties}>
            {title}
          </h2>
          <p className={cn(s.reveal, "mt-4 text-[15px] leading-relaxed text-muted-foreground")} style={{ "--d": 2 } as React.CSSProperties}>
            {body}
          </p>
          <p className={cn(s.reveal, "fig mt-6 text-[clamp(22px,2.4vw,32px)] tnum")} style={{ "--d": 3 } as React.CSSProperties}>
            <span aria-hidden={finalStat ? true : undefined}>{stat}</span>
            {finalStat && <span className="sr-only">{finalStat}</span>}
          </p>
        </div>
        <div className="min-h-0">{figure}</div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="grid gap-6 border-t border-hair px-5 py-8 text-[13px] sm:grid-cols-[1fr_auto] sm:items-end sm:px-8">
      <div>
        <Wordmark />
        <p className="mt-3 max-w-[48ch] text-muted-foreground">
          Smaller files, same pixels. Images and video are encoded by your own browser, so nothing is ever uploaded.
        </p>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[12px] text-muted-foreground">
        <Link href="/app" className="hover:text-foreground">
          Open workspace
        </Link>
        <a href="#folder" className="hover:text-foreground">
          How it works
        </a>
        <span>Press ? in the workspace for shortcuts</span>
      </nav>
    </footer>
  );
}
