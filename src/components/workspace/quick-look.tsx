"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { outputs } from "@/engine/storage/outputs";
import { formatBytes, savedPct } from "@/lib/format";
import { sourceUrl } from "@/store/processor";
import { useWorkspace, visibleIds } from "@/store/workspace";
import { CompareStage, FIT, ZOOM_STEPS, type View } from "./compare-stage";
import { Kbd } from "./primitives";
import { focusQueue, ignoreKey } from "./shortcuts";

/** Floating split compare over the queue. Space or Esc closes, ↑↓ step, 1–4 zoom, Enter opens Compare. */
export function QuickLook() {
  const router = useRouter();
  const id = useWorkspace((s) => s.quickLookId);
  const items = useWorkspace((s) => s.items);
  const order = useWorkspace((s) => s.order);
  const sort = useWorkspace((s) => s.sort);
  const filter = useWorkspace((s) => s.filter);
  const ids = useMemo(() => visibleIds({ items, order, sort, filter }), [items, order, sort, filter]);
  const [split, setSplit] = useState(0.5);
  const [view, setView] = useState<View>(FIT);
  const [viewFor, setViewFor] = useState(id);
  if (viewFor !== id) {
    setViewFor(id);
    setView(FIT);
  }

  const it = id ? items[id] : undefined;
  const close = () => useWorkspace.getState().setQuickLook(null);

  const content = useRef<HTMLDivElement>(null);

  // Window-level like the queue, so keys work wherever focus is inside the dialog. Esc is Radix's.
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => {
      if (ignoreKey(e, { insideQuickLook: true }) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === " ") {
        if (!e.repeat) close();
      } else if (k === "ArrowDown" || k === "ArrowUp" || k === "j" || k === "k") {
        const i = ids.indexOf(id);
        const next = ids[Math.max(0, Math.min(ids.length - 1, i + (k === "ArrowDown" || k === "j" ? 1 : -1)))];
        if (next && next !== id) {
          useWorkspace.getState().setQuickLook(next);
          useWorkspace.getState().select([next], next);
        }
      } else if (k >= "1" && k <= "4") {
        const scale = ZOOM_STEPS[Number(k) - 1];
        setView(scale ? { scale, x: 0, y: 0 } : FIT);
      } else if (k === "Enter") {
        close();
        router.push(`/app/compare/${id}`);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, ids, router]);

  const out = it?.status === "done" ? it.output : undefined;
  const pct = it && out ? savedPct(it.file.size, out.size) : null;

  return (
    <Dialog open={!!it} onOpenChange={(o) => !o && close()}>
      <DialogContent
        ref={content}
        data-quick-look
        showCloseButton={false}
        // Focus the dialog itself rather than the split handle, and hand focus back to the queue on close.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          content.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusQueue();
        }}
        className="grid h-[min(80vh,760px)] w-[min(92vw,1200px)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-(--control-radius) border-rule bg-background p-0 sm:max-w-none"
      >
        {it && (
          <>
            <div className="flex items-baseline gap-3 border-b border-rule px-4 py-2.5">
              <DialogTitle className="min-w-0 truncate text-[15px] font-bold">{it.file.name}</DialogTitle>
              <span className="text-[12px] text-muted-foreground tnum">
                {formatBytes(it.file.size)}
                {out && ` → ${formatBytes(out.size)} ${out.format}`}
              </span>
              {pct !== null && (
                <span className="ml-auto font-mono text-[15px] font-medium text-ok tnum">
                  {out?.keptOriginal ? "Already optimal" : pct > 0 ? `−${pct}%` : `+${-pct}%`}
                </span>
              )}
            </div>
            <CompareStage
              left={it.kind === "image" ? sourceUrl(it.id) : it.thumbUrl}
              right={it.kind === "image" && out ? outputs.displayUrl(out.key) : it.thumbUrl}
              width={it.probe?.width ?? 0}
              height={it.probe?.height ?? 0}
              mode="split"
              view={view}
              onView={setView}
              split={split}
              onSplit={setSplit}
              labels={["Original", out ? out.format : "Encoding…"]}
            />
            <p className="border-t border-hair px-4 py-2 text-[11px] text-muted-foreground">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> step · <Kbd>1</Kbd>–<Kbd>4</Kbd> zoom · <Kbd>enter</Kbd> open Compare · <Kbd>space</Kbd> or <Kbd>esc</Kbd> close ·
              scroll to zoom, drag to pan
              {it.kind === "video" && " · video frames compare in the full view"}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
