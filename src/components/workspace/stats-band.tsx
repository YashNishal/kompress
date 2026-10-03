"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { bytesParts, formatDuration, savedPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { totals, useWorkspace } from "@/store/workspace";
import { useCapabilities } from "@/hooks/use-capabilities";

const SEGMENTS = 24;

export function StatsBand() {
  const items = useWorkspace((s) => s.items);
  const order = useWorkspace((s) => s.order);
  const t = useMemo(() => totals(items, order), [items, order]);
  const caps = useCapabilities();
  const eta = useEta(t.progress, t.count);

  const [inV, inU] = bytesParts(t.inBytes);
  const [outV, outU] = bytesParts(t.outBytes);
  const pct = t.doneInBytes ? savedPct(t.doneInBytes, t.outBytes) : null;
  const filled = Math.round(t.progress * SEGMENTS);
  const busy = t.done + t.failed < t.count;
  const hw = caps && Object.values(caps.videoEncode).some((c) => c.hw);

  return (
    <div className="grid shrink-0 grid-cols-[repeat(4,minmax(0,1fr))_300px] border-b border-rule">
      <Stat k="In" v={inV} u={inU} />
      <Stat k="Out" v={t.done ? outV : "—"} u={t.done ? outU : undefined} />
      <Stat k="Saved">{pct !== null ? <span className="text-ok">−{Math.max(0, pct)}%</span> : "—"}</Stat>
      <Stat k="Files" v={String(t.done)} u={`/ ${t.count} done`} last />
      <div className="flex flex-col justify-between px-4 py-3.5">
        <div className="label-caps text-muted-foreground">
          Job · {caps ? `${Math.max(1, Math.min(caps.cores - 1, 6))} workers` : "…"}
          {hw ? " · hardware video" : ""}
        </div>
        <div className="mt-2.5 grid gap-px" style={{ gridTemplateColumns: `repeat(${SEGMENTS}, 1fr)` }} aria-hidden>
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <i key={i} className={cn("h-1.5", i < filled ? "bg-acid" : "bg-bar-track")} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[13px] font-semibold tnum" aria-live="polite">
          <span>{t.count ? `${Math.round(t.progress * 100)}%` : "Idle"}</span>
          <span className="font-medium text-muted-foreground">
            {busy && t.count ? (eta !== null ? `~${formatDuration(eta)} left` : "estimating…") : t.count ? "All done" : ""}
            {t.failed > 0 && <span className="ml-2 text-destructive">{t.failed} failed</span>}
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  k,
  v,
  u,
  last,
  children,
}: {
  k: string;
  v?: string;
  u?: string;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 border-r px-4 pb-2.5 pt-3", last ? "border-rule" : "border-hair")}>
      <div className="label-caps text-muted-foreground">{k}</div>
      <div className="fig mt-1.5 truncate text-[26px] leading-none tnum">
        {children ?? v}
        {u && <small className="ml-1 text-[12px] font-normal tracking-[-0.01em] text-muted-foreground">{u}</small>}
      </div>
    </div>
  );
}

/** ETA from observed throughput since the current run started. */
function useEta(progress: number, count: number) {
  const start = useRef<{ t: number; p: number } | null>(null);
  const latest = useRef(progress);
  const [eta, setEta] = useState<number | null>(null);
  const running = progress < 1 && count > 0;

  useEffect(() => {
    latest.current = progress;
  }, [progress]);

  useEffect(() => {
    if (!running) {
      start.current = null;
      return;
    }
    start.current ??= { t: performance.now(), p: latest.current };
    const id = setInterval(() => {
      const s = start.current!;
      const p = latest.current;
      const dp = p - s.p;
      const dt = (performance.now() - s.t) / 1000;
      setEta(dp <= 0.02 || dt < 2 ? null : ((1 - p) * dt) / dp);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  return running ? eta : null;
}
