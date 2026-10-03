"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Film, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useRef, type MouseEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  IMAGE_FORMATS,
  VIDEO_CODECS,
  hasOverrides,
  outputFps,
  resolveFor,
  resolveVideo,
  videoBitrate,
  videoTargetSize,
} from "@/engine/settings";
import type { QueueItem } from "@/engine/types";
import { formatBytes, formatDuration, savedPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { encode, removeItems, retry } from "@/store/processor";
import { useWorkspace, visibleIds, type Filter, type SortKey } from "@/store/workspace";
import { Kbd, RatioBar, Segmented } from "./primitives";
import { ignoreKey, isMod } from "./shortcuts";
import { QueueEmpty } from "./queue-empty";

const ROW = 46;
const COLS = "grid-cols-[52px_52px_minmax(0,1fr)_128px_minmax(96px,200px)_112px_84px_36px]";

export function QueueTable() {
  const items = useWorkspace((s) => s.items);
  const order = useWorkspace((s) => s.order);
  const sort = useWorkspace((s) => s.sort);
  const filter = useWorkspace((s) => s.filter);
  const selected = useWorkspace((s) => s.selected);
  const global = useWorkspace((s) => s.global);

  const ids = useMemo(() => visibleIds({ items, order, sort, filter }), [items, order, sort, filter]);
  const numbers = useMemo(() => new Map(order.map((id, i) => [id, i + 1])), [order]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const scroller = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW,
    overscan: 10,
  });
  // The moving end of the selection (the anchor is the fixed end). Arrow keys step from here.
  const lead = useRef<string | null>(null);
  useQueueKeys(ids, lead, (i) => virtual.scrollToIndex(i, { align: "auto" }));

  if (!order.length) return <QueueEmpty />;

  const onRowClick = (e: MouseEvent, id: string) => {
    const { selected, anchor, select } = useWorkspace.getState();
    lead.current = id;
    if (e.shiftKey && anchor && ids.includes(anchor)) {
      const [a, b] = [ids.indexOf(anchor), ids.indexOf(id)].sort((x, y) => x - y);
      select(ids.slice(a, b + 1), anchor);
    } else if (isMod(e)) {
      select(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id], id);
    } else {
      select(selected.length === 1 && selected[0] === id ? [] : [id], id);
    }
  };

  return (
    <section className="flex min-h-0 flex-col" aria-label="Queue">
      <Toolbar />
      <div
        role="row"
        className={cn("grid shrink-0 items-center border-b border-rule px-0 py-2 text-muted-foreground label-caps", COLS)}
      >
        <span className="pl-4">#</span>
        <span />
        <span>File</span>
        <span>Conversion</span>
        <span>After / before</span>
        <span className="text-right">Size</span>
        <span className="text-right">Saved</span>
        <span />
      </div>
      <div
        ref={scroller}
        role="grid"
        aria-multiselectable
        aria-rowcount={ids.length}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {ids.length === 0 ? (
          <p className="px-4 py-10 text-[13px] text-muted-foreground">Nothing matches this filter.</p>
        ) : (
          <div className="relative" style={{ height: virtual.getTotalSize() }}>
            {virtual.getVirtualItems().map((v) => {
              const it = items[ids[v.index]];
              return (
                <Row
                  key={it.id}
                  item={it}
                  n={numbers.get(it.id) ?? 0}
                  selected={selectedSet.has(it.id)}
                  conversion={conversionLabel(it, global)}
                  top={v.start}
                  height={ROW}
                  onClick={onRowClick}
                />
              );
            })}
          </div>
        )}
      </div>
      <p className="hidden shrink-0 border-t border-hair px-4 py-2 text-[11px] text-muted-foreground md:block">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> move · <Kbd>⇧</Kbd> extend · <Kbd>space</Kbd> Quick Look · <Kbd>enter</Kbd> Compare · <Kbd>R</Kbd> retry ·{" "}
        <Kbd>⌫</Kbd> remove · <Kbd>?</Kbd> all shortcuts
      </p>
    </section>
  );
}

/**
 * Queue shortcuts. Listens on window so they keep working wherever focus is, and
 * stands aside while Quick Look is open (it has its own keys).
 */
function useQueueKeys(ids: string[], lead: React.RefObject<string | null>, scrollTo: (i: number) => void) {
  const router = useRouter();
  const latest = useRef({ ids, scrollTo });
  useEffect(() => {
    latest.current = { ids, scrollTo };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useWorkspace.getState();
      if (s.quickLookId || ignoreKey(e)) return;
      const { ids, scrollTo } = latest.current;
      if (!ids.length) return;
      const { selected, anchor, select } = s;
      const cur = lead.current && selected.includes(lead.current) ? lead.current : (selected.at(-1) ?? null);
      const at = cur ? ids.indexOf(cur) : -1;
      const target = cur ?? ids[0];

      const moveTo = (i: number) => {
        const id = ids[Math.max(0, Math.min(ids.length - 1, i))];
        if (e.shiftKey) {
          const from = anchor && ids.includes(anchor) ? anchor : (cur ?? id);
          const [a, b] = [ids.indexOf(from), ids.indexOf(id)].sort((x, y) => x - y);
          select(ids.slice(a, b + 1), from);
        } else select([id], id);
        lead.current = id;
        scrollTo(ids.indexOf(id));
      };

      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (isMod(e) && k === "a" && !e.shiftKey && !e.altKey) {
        select(ids, ids[0]);
        lead.current = ids.at(-1) ?? null;
      } else if (e.metaKey || e.ctrlKey || e.altKey) {
        return; // other chords belong to the top bar or the browser
      } else if (k === "ArrowDown" || k === "j") {
        moveTo(at < 0 ? 0 : at + 1);
      } else if (k === "ArrowUp" || k === "k") {
        moveTo(at < 0 ? ids.length - 1 : at - 1);
      } else if (k === "Home") {
        moveTo(0);
      } else if (k === "End") {
        moveTo(ids.length - 1);
      } else if (k === " ") {
        if (!e.repeat) {
          if (!selected.includes(target)) select([target], target);
          lead.current = target;
          s.setQuickLook(target);
        }
      } else if (k === "Enter") {
        router.push(`/app/compare/${target}`);
      } else if (k === "Escape") {
        if (!selected.length) return;
        select([], null);
      } else if (k === "Backspace" || k === "Delete") {
        if (!selected.length) return;
        // Land on the file after the removed block so the keyboard can keep going.
        const gone = new Set(selected);
        const last = Math.max(...selected.map((id) => ids.indexOf(id)));
        const next = ids.slice(last + 1).find((id) => !gone.has(id)) ?? ids.slice(0, last).reverse().find((id) => !gone.has(id));
        removeItems(selected);
        if (next) {
          select([next], next);
          lead.current = next;
        }
        toast(`Removed ${selected.length} file${selected.length === 1 ? "" : "s"}`);
      } else if (k === "r") {
        const pool = selected.length ? selected : ids;
        const again = pool.filter((id) => s.items[id]?.status === "failed" || s.items[id]?.status === "cancelled");
        if (!again.length) return;
        again.forEach(retry);
        toast(`Retrying ${again.length} file${again.length === 1 ? "" : "s"}`);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead, router]);
}

function conversionLabel(it: QueueItem, global: ReturnType<typeof useWorkspace.getState>["global"]) {
  const r = resolveFor(it, global);
  const from = it.probe?.label ?? "…";
  if (r.kind === "image") {
    const to = IMAGE_FORMATS[r.settings.format].label;
    const q = r.settings.lossless || r.settings.format === "png" ? "lossless" : `q${r.settings.quality}`;
    return { from, to, detail: q };
  }
  const to = VIDEO_CODECS[r.settings.codec].label;
  const detail = r.settings.mode === "target" ? `≤${r.settings.targetMB} MB` : `${r.settings.resolution === "source" ? "src" : `${r.settings.resolution}p`}`;
  return { from, to, detail };
}

const Row = memo(function Row({
  item: it,
  n,
  selected,
  conversion,
  top,
  height,
  onClick,
}: {
  item: QueueItem;
  n: number;
  selected: boolean;
  conversion: { from: string; to: string; detail: string };
  top: number;
  height: number;
  onClick: (e: MouseEvent, id: string) => void;
}) {
  const out = it.output;
  const ratio = out ? out.size / it.file.size : null;
  const pct = out ? savedPct(it.file.size, out.size) : null;
  const dims = it.probe ? `${it.probe.width}×${it.probe.height}` : "";
  const meta = [dims, it.probe?.duration ? formatDuration(it.probe.duration) : "", formatBytes(it.file.size)].filter(Boolean).join(" · ");

  return (
    <div
      role="row"
      aria-selected={selected}
      onClick={(e) => onClick(e, it.id)}
      className={cn(
        "group absolute inset-x-0 grid cursor-default select-none items-center border-b border-hair animate-row-in",
        COLS,
        selected ? "bg-accent/50" : "hover:bg-secondary/50",
      )}
      style={{ top, height }}
    >
      <span className={cn("relative h-full pl-4 text-[12px] tnum pt-[15px] font-mono font-normal", selected ? "text-foreground" : "text-muted-foreground")}>
        {selected && <i className="absolute inset-y-0 left-0 bg-acid w-[2px]" aria-hidden />}
        {String(n).padStart(3, "0")}
      </span>

      <span className="relative overflow-hidden bg-muted size-7 rounded-[3px]">
        {it.thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.thumbUrl} alt="" className="size-full object-cover" draggable={false} />
        )}
        {it.kind === "video" && (
          <Film className="absolute bottom-0.5 right-0.5 size-3.5 bg-foreground p-[2px] text-background" aria-label="Video" />
        )}
      </span>

      <span className="min-w-0 pr-4">
        <span className="block truncate text-[13px] font-semibold" title={it.path}>
          {it.file.name}
        </span>
        <span className="block truncate text-[11.5px] text-muted-foreground tnum">{meta}</span>
      </span>

      <span className="min-w-0 truncate pr-3 text-[12px] font-semibold">
        <span className="text-muted-foreground">{conversion.from}</span>
        <span className="mx-1 text-muted-foreground">→</span>
        {conversion.to}
        <span className="ml-1.5 font-mono text-[10.5px] font-normal text-muted-foreground">{conversion.detail}</span>
        {hasOverrides(it) && (
          <i className="ml-1.5 inline-block size-[6px] translate-y-[-1px] bg-acid" title="Has its own settings" />
        )}
      </span>

      {it.status === "failed" && it.error ? (
        <FailedCells item={it} />
      ) : (
        <>
          <span className="pr-4">
            {it.status === "encoding" ? (
              <RatioBar ratio={null} running={it.progress} />
            ) : it.status === "done" ? (
              <RatioBar ratio={ratio} />
            ) : (
              <span className="text-[12px] font-medium text-muted-foreground">
                {it.status === "probing" ? "Reading…" : it.status === "cancelled" ? "Cancelled" : "Queued"}
              </span>
            )}
          </span>
          <span className="pr-1 text-right tnum">
            {out && it.status === "done" ? (
              <>
                <span className="block text-[13px] font-bold">{formatBytes(out.size)}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {out.width !== it.probe?.width ? `${out.width}×${out.height}` : `from ${formatBytes(it.file.size)}`}
                </span>
              </>
            ) : it.status === "encoding" ? (
              <span className="text-[12px] font-semibold text-muted-foreground">{Math.round(it.progress * 100)}%</span>
            ) : null}
          </span>
          <span className="pr-1 text-right tnum">
            {out && it.status === "done" && pct !== null ? (
              out.keptOriginal ? (
                <span className="text-[11px] font-semibold leading-tight text-muted-foreground">Already optimal</span>
              ) : (
                <span
                  className={cn("font-mono text-[13px] font-medium tracking-[-0.03em]", pct > 0 ? "text-ok" : "text-destructive")}
                >
                  {pct > 0 ? `−${pct}%` : `+${-pct}%`}
                </span>
              )
            ) : null}
          </span>
        </>
      )}

      <span className="flex justify-center">
        <button
          type="button"
          aria-label={`Remove ${it.file.name}`}
          onClick={(e) => {
            e.stopPropagation();
            removeItems([it.id]);
          }}
          className="grid size-7 place-items-center text-muted-foreground opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      </span>
    </div>
  );
});

function FailedCells({ item: it }: { item: QueueItem }) {
  const e = it.error!;
  const action = recoveryAction(it);
  return (
    <span className="col-span-3 flex min-w-0 items-center gap-3 pr-1">
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-destructive" title={e.message}>
        {e.message}
      </span>
      {action && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 shrink-0 rounded-(--control-radius) px-2.5 text-[11.5px]"
          onClick={(ev) => {
            ev.stopPropagation();
            action.run();
          }}
        >
          {action.label}
        </Button>
      )}
    </span>
  );
}

function recoveryAction(it: QueueItem): { label: string; run: () => void } | null {
  const e = it.error!;
  const st = useWorkspace.getState;
  switch (e.code) {
    case "TARGET_UNREACHABLE": {
      const mb = smallestTargetMB(it);
      if (!mb) return { label: "Change", run: () => st().select([it.id], it.id) };
      return {
        label: `Use ${mb} MB`,
        run: () => {
          st().setOverride(it.id, { video: { mode: "target", targetMB: mb } });
          encode(it.id, "interactive");
        },
      };
    }
    case "OUT_OF_MEMORY":
      return {
        label: it.kind === "video" ? "Retry at 1080p" : "Retry smaller",
        run: () => {
          if (it.kind === "video") st().setOverride(it.id, { video: { resolution: 1080 } });
          else st().setOverride(it.id, { image: { resize: { mode: "longest", value: 2560 } } });
          encode(it.id, "interactive");
        },
      };
    case "UNSUPPORTED_INPUT":
    case "DECODE_FAILED":
      // The ffmpeg fallback lands in phase 6; until then the honest option is removal.
      return { label: "Remove", run: () => removeItems([it.id]) };
    case "ENCODER_UNAVAILABLE":
      if (it.kind === "video")
        return {
          label: "Use H.264",
          run: () => {
            st().setOverride(it.id, { video: { codec: "avc" } });
            encode(it.id, "interactive");
          },
        };
      return { label: "Retry", run: () => retry(it.id) };
    default:
      return { label: "Retry", run: () => retry(it.id) };
  }
}

/** Smallest reachable target for a video at its current settings, rounded up with a little headroom. */
function smallestTargetMB(it: QueueItem) {
  const p = it.probe;
  if (!p?.duration) return null;
  const s = resolveVideo(useWorkspace.getState().global, it.overrides);
  const dims = videoTargetSize(p.width, p.height, s.resolution);
  const duration = Math.max(0.1, (s.trim.end ?? p.duration) - s.trim.start);
  const { minBytes } = videoBitrate(s, { ...dims, fps: outputFps(s, p.fps ?? 30), duration });
  return minBytes ? Math.ceil((minBytes * 1.05) / 1e6) : null;
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: "added", label: "Order added" },
  { value: "saved", label: "Most saved" },
  { value: "size", label: "Largest first" },
  { value: "name", label: "Name" },
];

function Toolbar() {
  const items = useWorkspace((s) => s.items);
  const order = useWorkspace((s) => s.order);
  const filter = useWorkspace((s) => s.filter);
  const sort = useWorkspace((s) => s.sort);
  const selected = useWorkspace((s) => s.selected);
  const setFilter = useWorkspace((s) => s.setFilter);
  const setSort = useWorkspace((s) => s.setSort);
  const select = useWorkspace((s) => s.select);

  const counts = useMemo(() => {
    const c = { all: order.length, image: 0, video: 0, failed: 0 };
    for (const id of order) {
      const it = items[id];
      c[it.kind]++;
      if (it.status === "failed") c.failed++;
    }
    return c;
  }, [items, order]);

  const options: { value: Filter; label: string }[] = [
    { value: "all", label: `All ${counts.all}` },
    { value: "image", label: `Images ${counts.image}` },
    { value: "video", label: `Videos ${counts.video}` },
    { value: "failed", label: `Failed ${counts.failed}` },
  ];

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-hair px-4">
      {selected.length ? (
        <>
          <span className="text-[13px] font-bold tnum">{selected.length} selected</span>
          {selected.some((id) => items[id]?.status === "failed") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-(--control-radius) px-2"
              onClick={() => selected.filter((id) => items[id]?.status === "failed").forEach(retry)}
            >
              Retry failed
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 rounded-(--control-radius) px-2 text-destructive" onClick={() => removeItems(selected)}>
            Remove
          </Button>
          <Button size="sm" variant="ghost" className="h-7 rounded-(--control-radius) px-2 text-muted-foreground" onClick={() => select([], null)}>
            Deselect <Kbd>esc</Kbd>
          </Button>
        </>
      ) : (
        <Segmented size="sm" value={filter} onChange={setFilter} options={options} aria-label="Filter" className="w-[380px]" />
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="label-caps text-muted-foreground">Sort</span>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger size="sm" className="h-7 w-[140px] rounded-(--control-radius) text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
