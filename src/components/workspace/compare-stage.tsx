"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { cn } from "@/lib/utils";

export type CompareMode = "split" | "side" | "diff";

/** `scale` is in source pixels per CSS pixel; 0 means "fit". Offsets are from the pane centre. */
export interface View {
  scale: number;
  x: number;
  y: number;
}

export const FIT: View = { scale: 0, x: 0, y: 0 };
export const ZOOM_STEPS = [0, 2, 4, 8] as const;

const MAX_SCALE = 16;

function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function fitScale(pane: { w: number; h: number }, w: number, h: number) {
  if (!pane.w || !pane.h || !w || !h) return 1;
  return Math.min(1, (pane.w - 32) / w, (pane.h - 32) / h);
}

/**
 * The Studio canvas: always neutral dark, both sides drawn at the source's
 * dimensions so a resized encode lines up pixel-for-pixel with the original.
 */
export function CompareStage({
  left,
  right,
  width,
  height,
  mode,
  view,
  onView,
  split,
  onSplit,
  showOriginal,
  labels,
  className,
}: {
  left?: string;
  right?: string;
  width: number;
  height: number;
  mode: CompareMode;
  view: View;
  onView: (v: View) => void;
  split: number;
  onSplit: (v: number) => void;
  /** Hold-Space override: show the left (original) side everywhere. */
  showOriginal?: boolean;
  labels?: [string, string];
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const size = useSize(root);
  const pane = mode === "side" ? { w: size.w / 2, h: size.h } : size;
  const fit = fitScale(pane, width, height);
  const scale = view.scale || fit;
  const pixelated = scale > 1.01;

  // Wheel / trackpad pinch zoom, anchored under the cursor. Non-passive so we can stop page scroll.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const paneW = mode === "side" ? rect.width / 2 : rect.width;
      const localX = (e.clientX - rect.left) % paneW;
      const px = localX - paneW / 2;
      const py = e.clientY - rect.top - rect.height / 2;
      const v = viewRef.current;
      const s = v.scale || fit;
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      const next = Math.min(MAX_SCALE, Math.max(fit * 0.5, s * factor));
      const k = next / s;
      onView({ scale: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fit, mode, onView]);

  // Drag to pan.
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-handle]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    onView({ scale: view.scale || fit, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y });
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const imgStyle = {
    width: width * scale,
    height: height * scale,
    left: `calc(50% - ${(width * scale) / 2}px + ${view.x}px)`,
    top: `calc(50% - ${(height * scale) / 2}px + ${view.y}px)`,
  };
  const img = (src: string | undefined, extra?: string) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn("absolute max-w-none select-none", pixelated && "pixelated", extra)}
        style={imgStyle}
      />
    ) : null;

  const rightSrc = showOriginal ? left : right;

  return (
    <div
      ref={root}
      className={cn("relative touch-none overflow-hidden bg-canvas text-white", dragging ? "cursor-grabbing" : "cursor-grab", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onView(view.scale ? FIT : { scale: 1, x: 0, y: 0 })}
    >
      {mode === "split" && (
        <>
          {img(left)}
          <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}>
            {img(rightSrc)}
          </div>
          <SplitHandle value={split} onChange={onSplit} container={root} />
        </>
      )}

      {mode === "side" && (
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="relative overflow-hidden border-r border-white/10">{img(left)}</div>
          <div className="relative overflow-hidden">{img(rightSrc)}</div>
        </div>
      )}

      {mode === "diff" && (
        // Absolute difference, amplified so small codec errors become visible.
        <div className="absolute inset-0" style={{ isolation: "isolate", filter: "brightness(6) contrast(1.4)" }}>
          {img(left)}
          {img(rightSrc, "mix-blend-difference")}
        </div>
      )}

      {labels && mode !== "diff" && (
        <>
          <Tag className="left-3">{labels[0]}</Tag>
          <Tag className={mode === "side" ? "left-[calc(50%+12px)]" : "right-3"}>{showOriginal ? labels[0] : labels[1]}</Tag>
        </>
      )}
      {mode === "diff" && <Tag className="left-3">Difference ×6</Tag>}
      <Tag className="bottom-3 top-auto right-3 font-mono">
        {view.scale ? `${Math.round(scale * 100)}%` : `Fit ${Math.round(fit * 100)}%`}
      </Tag>
    </div>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("pointer-events-none absolute top-3 bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide", className)}>
      {children}
    </span>
  );
}

function SplitHandle({
  value,
  onChange,
  container,
}: {
  value: number;
  onChange: (v: number) => void;
  container: RefObject<HTMLDivElement | null>;
}) {
  const move = (clientX: number) => {
    const r = container.current?.getBoundingClientRect();
    if (r) onChange(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };
  return (
    <div
      data-handle
      role="slider"
      tabIndex={0}
      aria-label="Split position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && move(e.clientX)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.02;
        if (e.key === "ArrowLeft") onChange(Math.max(0, value - step));
        else if (e.key === "ArrowRight") onChange(Math.min(1, value + step));
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
      className="group absolute inset-y-0 z-10 w-6 -translate-x-1/2 cursor-ew-resize outline-none"
      style={{ left: `${value * 100}%` }}
    >
      <i className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-acid" />
      <i className="absolute left-1/2 top-1/2 grid h-9 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center bg-acid text-[10px] font-bold text-acid-foreground group-focus-visible:ring-2 group-focus-visible:ring-white">
        ⟷
      </i>
    </div>
  );
}
