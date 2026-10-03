"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatTimecode } from "@/lib/format";
import { cn } from "@/lib/utils";
import { videoEngine } from "@/store/video-processor";
import { Kbd } from "./primitives";
import { ignoreKey } from "./shortcuts";

const FRAMES = 14;

export interface Trim {
  start: number;
  end: number | null;
}

/**
 * Filmstrip timeline with a playhead and two trim handles. Everything snaps
 * to the source frame grid, so the in/out points are frame-accurate. Trim is
 * held locally while dragging and committed on release (a commit re-encodes).
 */
export function VideoTimeline({
  file,
  duration,
  fps,
  t,
  onSeek,
  trim,
  onTrim,
}: {
  file: Blob;
  duration: number;
  fps: number;
  t: number;
  onSeek: (t: number) => void;
  trim: Trim;
  onTrim: (trim: Trim) => void;
}) {
  const frames = useFilmstrip(file);
  const track = useRef<HTMLDivElement>(null);
  const frame = 1 / (fps || 30);
  const snap = (v: number) => Math.min(duration, Math.max(0, Math.round(v / frame) * frame));

  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const start = draft?.start ?? trim.start;
  const end = draft?.end ?? trim.end ?? duration;
  const dragging = useRef<"start" | "end" | "seek" | null>(null);

  const timeAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return snap(((clientX - r.left) / r.width) * duration);
  };

  const commit = (s: number, e: number) => {
    const next: Trim = { start: s <= frame / 2 ? 0 : s, end: e >= duration - frame / 2 ? null : e };
    if (next.start !== trim.start || next.end !== trim.end) onTrim(next);
  };

  const onDown = (e: ReactPointerEvent, what: "start" | "end" | "seek") => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = what;
    if (what === "seek") onSeek(timeAt(e.clientX));
    else setDraft({ start, end });
  };
  const onMove = (e: ReactPointerEvent) => {
    const what = dragging.current;
    if (!what) return;
    const v = timeAt(e.clientX);
    if (what === "seek") onSeek(v);
    else if (what === "start") {
      const s = Math.min(v, end - frame);
      setDraft({ start: s, end });
      onSeek(s);
    } else {
      const en = Math.max(v, start + frame);
      setDraft({ start, end: en });
      onSeek(en);
    }
  };
  const onUp = () => {
    if (dragging.current !== "seek" && draft) commit(draft.start, draft.end);
    dragging.current = null;
    setDraft(null);
  };

  // Keyboard: , . step one frame (shift = 1 s), I / O set in and out at the playhead.
  const latest = useRef({ t, start, end });
  useEffect(() => {
    latest.current = { t, start, end };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignoreKey(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const { t, start, end } = latest.current;
      const step = e.shiftKey ? 1 : frame;
      if (e.key === "," || e.key === "<") onSeek(snap(t - step));
      else if (e.key === "." || e.key === ">") onSeek(snap(t + step));
      else if (e.key === "i" || e.key === "I") commit(Math.min(snap(t), end - frame), end);
      else if (e.key === "o" || e.key === "O") commit(start, Math.max(snap(t), start + frame));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pct = (v: number) => `${(v / duration) * 100}%`;
  const trimmed = start > 0 || end < duration;

  return (
    <div className="bg-canvas px-4 pb-3 pt-2 text-white">
      <div
        ref={track}
        className="relative h-12 cursor-pointer touch-none select-none overflow-hidden bg-black"
        onPointerDown={(e) => onDown(e, "seek")}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${FRAMES}, 1fr)` }}>
          {Array.from({ length: FRAMES }, (_, i) =>
            frames[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={frames[i]} alt="" draggable={false} className="h-full w-full object-cover" />
            ) : (
              <i key={i} className="border-r border-white/5 bg-white/[0.04]" />
            ),
          )}
        </div>
        {/* Outside the trim: dimmed. */}
        <i className="absolute inset-y-0 left-0 bg-black/70" style={{ width: pct(start) }} />
        <i className="absolute inset-y-0 right-0 bg-black/70" style={{ left: pct(end) }} />
        <i className="pointer-events-none absolute inset-y-0 border-y-2 border-acid" style={{ left: pct(start), right: `calc(100% - ${pct(end)})` }} />
        <Handle side="start" at={pct(start)} onPointerDown={(e) => onDown(e, "start")} onMove={onMove} onUp={onUp} />
        <Handle side="end" at={pct(end)} onPointerDown={(e) => onDown(e, "end")} onMove={onMove} onUp={onUp} />
        <i className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.5)]" style={{ left: pct(t) }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tnum">
        <span>
          <span className="text-white/50">at </span>
          {formatTimecode(t)}
          <span className="text-white/40"> · f{Math.round(t / frame)}</span>
        </span>
        <span>
          <span className="text-white/50">in </span>
          {formatTimecode(start)}
        </span>
        <span>
          <span className="text-white/50">out </span>
          {formatTimecode(end)}
        </span>
        <span className={cn(trimmed && "bg-acid px-1 text-acid-foreground")}>
          <span className={cn(!trimmed && "text-white/50")}>length </span>
          {formatTimecode(end - start)}
        </span>
        {trimmed && (
          <button
            type="button"
            className="font-sans text-[11px] font-semibold underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-acid"
            onClick={() => onTrim({ start: 0, end: null })}
          >
            Reset trim
          </button>
        )}
        <span className="ml-auto hidden font-sans text-white/50 lg:inline">
          <Kbd>,</Kbd>
          <Kbd>.</Kbd> frame · <Kbd>I</Kbd>
          <Kbd>O</Kbd> set in/out
        </span>
      </div>
    </div>
  );
}

function Handle({
  side,
  at,
  onPointerDown,
  onMove,
  onUp,
}: {
  side: "start" | "end";
  at: string;
  onPointerDown: (e: ReactPointerEvent) => void;
  onMove: (e: ReactPointerEvent) => void;
  onUp: () => void;
}) {
  return (
    <div
      aria-hidden
      onPointerDown={onPointerDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className={cn(
        "absolute inset-y-0 z-10 flex w-3 cursor-ew-resize items-center justify-center bg-acid",
        side === "start" ? "-translate-x-full" : "",
      )}
      style={{ left: at }}
    >
      <i className="h-4 w-px bg-acid-foreground/60" />
    </div>
  );
}

/** Evenly spaced thumbnails for the timeline, as object URLs. */
function useFilmstrip(file: Blob) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    let made: string[] = [];
    videoEngine
      .filmstrip(file, FRAMES, 160)
      .then((blobs) => {
        made = blobs.map((b) => URL.createObjectURL(b));
        if (live) setUrls(made);
        else made.forEach(URL.revokeObjectURL);
      })
      .catch(() => {});
    return () => {
      live = false;
      made.forEach(URL.revokeObjectURL);
    };
  }, [file]);
  return urls;
}
