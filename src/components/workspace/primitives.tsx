"use client";

import { Slider as SliderPrimitive, ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The Kompress mark: a lowercase k whose arm is the wordmark's slash. It takes its colours from the
 * theme (ink tile, paper glyph, accent arm), so it matches app/icon.svg in light mode.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-5 shrink-0", className)}>
      <rect width="64" height="64" rx="14" className="fill-foreground" />
      <path d="M20 10v44M31 36l14 18" strokeWidth="8" className="stroke-background" />
      <path d="M24 41 47 18" strokeWidth="8" className="stroke-acid" />
    </svg>
  );
}

/** Mark plus `kompress/`. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center gap-2 font-mono text-[15px] font-medium lowercase leading-none tracking-[-0.02em]",
        className,
      )}
    >
      <BrandMark />
      <span>
        Kompress
        <span className="text-acid">/</span>
      </span>
    </span>
  );
}

/** Inspector section with a small caps heading. */
export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-hair px-4 py-3.5", className)}>
      <header className="mb-2.5 flex items-baseline gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {title}
        {aside && <span className="ml-auto text-[11px] font-medium text-muted-foreground">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
}

/** One bordered group; the active item is raised grey (or acid when `accent`). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  accent,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegOption<T>[];
  accent?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      aria-label={ariaLabel}
      onValueChange={(v) => v && onChange(v as T)}
      className={cn("grid overflow-hidden rounded-(--control-radius) border border-input", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <ToggleGroupPrimitive.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          title={o.title}
          // A mouse click shouldn't park keyboard focus here, or Space and arrows stop reaching the workspace.
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "border-r border-input text-center font-medium text-muted-foreground outline-none transition-colors last:border-r-0",
            "hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-35",
            size === "md" ? "py-[7px] text-[12px]" : "py-[5px] text-[11.5px]",
            accent
              ? "data-[state=on]:bg-acid data-[state=on]:text-acid-foreground"
              : "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
          )}
        >
          {o.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

/** Quality: a hairline track, light fill and round knob, value in mono. */
export function QualityScale({
  value,
  onChange,
  onCommit,
  disabled,
  low = "Smaller",
  high = "Sharper",
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  disabled?: boolean;
  low?: string;
  high?: string;
}) {
  return (
    <div className={cn(disabled && "pointer-events-none opacity-40")}>
      <div className="mb-2 flex items-baseline justify-between text-[11px] text-muted-foreground">
        <span>{low}</span>
        <b className="font-mono text-[13px] font-medium text-accent-foreground tnum">{value}</b>
        <span>{high}</span>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={([v]) => onCommit?.(v)}
        className="relative flex h-4 w-full cursor-pointer touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-bar-track">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-bar-fill" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb aria-label="Quality" className="block size-3.5 rounded-full bg-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
      </SliderPrimitive.Root>
    </div>
  );
}

/** QualityScale that stays local while dragging and commits on release. */
export function DraftQuality({ value, onCommit, disabled }: { value: number; onCommit: (v: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(value);
  }
  return <QualityScale value={draft} onChange={setDraft} onCommit={onCommit} disabled={disabled} />;
}

/** After-size as a share of before-size; acid while `running`. */
export function RatioBar({
  ratio,
  running,
  inverted,
  className,
}: {
  ratio: number | null;
  running?: number;
  inverted?: boolean;
  className?: string;
}) {
  const pct = ratio === null ? 0 : Math.max(1, Math.min(100, ratio * 100));
  return (
    <div className={cn("relative h-[3px] overflow-hidden rounded-full", inverted ? "bg-white/15" : "bg-bar-track", className)}>
      <i
        className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-200", running !== undefined ? "bg-acid" : "bg-bar-fill")}
        style={{ width: `${running !== undefined ? Math.max(2, running * 100) : pct}%` }}
      />
    </div>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "mx-[2px] inline-block rounded-[3px] border border-b-2 border-current/30 px-[5px] font-mono text-[10.5px] leading-[16px] text-current",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
