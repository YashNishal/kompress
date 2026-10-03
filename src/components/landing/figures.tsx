import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Scene } from "./scene";
import s from "./landing.module.css";

/** Every figure shares one 600×520 canvas so the chapters line up. */
function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 600 520" className="mx-auto block h-auto max-h-[72dvh] w-full" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

const css = (v: Record<string, string | number>) => v as CSSProperties;
const PALETTE = ["#e07a5f", "#3a86ff", "#1b2a4a", "#8338ec", "#f2cc8f", "#3d405b", "#fb5607", "#2a9d8f"];

const TILE = { w: 72, h: 56, gap: 12, x0: 54, y0: 186 };
const FOLDER = { x: 300, y: 82 };

export function FolderFigure() {
  return (
    <Figure label="A folder opens and its files fan out into the queue, each starting its own progress bar.">
      <g>
        <rect x={244} y={56} width={112} height={64} rx={6} className="fill-card stroke-foreground" strokeWidth={2.5} />
        <path d="M244 62 v-14 h38 l8 8 h66" className="fill-none stroke-foreground" strokeWidth={2.5} strokeLinejoin="round" />
        <path d="M244 120 l8 -46 h112 l-8 46 Z" className={cn(s.lid, "fill-acid stroke-foreground")} strokeWidth={2.5} strokeLinejoin="round" />
      </g>
      {Array.from({ length: 24 }, (_, i) => {
        const x = TILE.x0 + (i % 6) * (TILE.w + TILE.gap);
        const y = TILE.y0 + Math.floor(i / 6) * (TILE.h + TILE.gap);
        return (
          <g
            key={i}
            className={s.tile}
            style={css({ "--i": i, "--dx": FOLDER.x - (x + TILE.w / 2), "--dy": FOLDER.y - (y + TILE.h / 2) })}
          >
            <rect x={x} y={y} width={TILE.w} height={TILE.h} rx={4} className="fill-card stroke-foreground" strokeWidth={2} />
            <rect x={x + 6} y={y + 6} width={TILE.w - 12} height={30} rx={2} fill={PALETTE[(i * 3) % PALETTE.length]} />
            <rect x={x + 6} y={y + 43} width={TILE.w - 12} height={5} rx={2.5} className="fill-bar-track" />
            <rect x={x + 6} y={y + 43} width={TILE.w - 12} height={5} rx={2.5} className={cn(s.tileBar, "fill-acid")} />
            <g className={s.tileCheck}>
              <circle cx={x + TILE.w - 4} cy={y + 4} r={9} className="fill-ok stroke-background" strokeWidth={2} />
              <path d={`M${x + TILE.w - 8.5} ${y + 4} l3 3 l5.5 -6`} className="fill-none stroke-background" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        );
      })}
    </Figure>
  );
}

/** PNG sizes in px (100 px = 1 MB) and the share each keeps as AVIF. */
const BARS: [number, number][] = [
  [260, 0.06], [310, 0.09], [200, 0.05], [340, 0.11], [280, 0.08], [230, 0.07],
  [300, 0.1], [250, 0.06], [320, 0.12], [210, 0.09], [290, 0.07], [270, 0.08],
];
const BASE = 450;

export function BarsFigure() {
  return (
    <Figure label="Twelve PNG files, each around 3 MB, shrink to a tenth of their height as they become AVIF.">
      {[1, 2, 3].map((mb) => (
        <g key={mb}>
          <line x1={48} x2={570} y1={BASE - mb * 100} y2={BASE - mb * 100} className="stroke-hair" strokeWidth={1.5} strokeDasharray="4 6" />
          <text x={44} y={BASE - mb * 100 + 4} textAnchor="end" fontSize={12} className="fill-muted-foreground">
            {mb} MB
          </text>
        </g>
      ))}
      <line x1={48} x2={570} y1={BASE} y2={BASE} className="stroke-foreground" strokeWidth={2.5} />
      {BARS.map(([h, r], i) => {
        const x = 64 + i * 42;
        return (
          <g key={i} className={s.col} style={css({ "--i": i, "--r": r })}>
            <g className={s.bar}>
              <rect x={x} y={BASE - h} width={28} height={h} rx={3} className="fill-muted-foreground" />
              <rect x={x} y={BASE - h} width={28} height={h} rx={3} className={cn(s.barAfter, "fill-acid")} />
            </g>
            <text x={x + 14} y={BASE + 22} textAnchor="middle" fontSize={11} className={cn(s.fmtBefore, "fill-muted-foreground")}>
              png
            </text>
            <text x={x + 14} y={BASE + 22} textAnchor="middle" fontSize={11} className={cn(s.fmtAfter, "fill-foreground")}>
              avif
            </text>
          </g>
        );
      })}
    </Figure>
  );
}

const FRAME = { x: 40, y: 50, w: 520, h: 320 };

function Dusk() {
  const { x, y, w, h } = FRAME;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#e07a5f" />
      <rect x={x} y={y} width={w} height={h * 0.42} fill="#1b2a4a" />
      <rect x={x} y={y + h * 0.42} width={w} height={h * 0.12} fill="#b9675a" opacity={0.6} />
      <circle cx={x + w * 0.66} cy={y + h * 0.52} r={42} fill="#fff4d6" />
      <path d={`M${x} ${y + h * 0.66} Q ${x + w * 0.25} ${y + h * 0.45} ${x + w * 0.5} ${y + h * 0.62} T ${x + w} ${y + h * 0.58} V ${y + h} H ${x} Z`} fill="#3d405b" />
      <path d={`M${x} ${y + h * 0.82} Q ${x + w * 0.3} ${y + h * 0.66} ${x + w * 0.62} ${y + h * 0.8} T ${x + w} ${y + h * 0.76} V ${y + h} H ${x} Z`} fill="#232540" />
      <path d={`M${x} ${y + h * 0.95} Q ${x + w * 0.4} ${y + h * 0.84} ${x + w} ${y + h * 0.93} V ${y + h} H ${x} Z`} fill="#15162a" />
    </g>
  );
}

/** Magnified pixels around the horizon, either side of the divider. They match, which is the point. */
const LOUPE_ROWS = ["#1b2a4a", "#1d2c4c", "#24304f", "#5a4152", "#a35d58", "#b9675a", "#cf7059", "#e07a5f"];

function Loupe({ cx, cy }: { cx: number; cy: number }) {
  const r = 62;
  const cell = 15.5;
  return (
    <g className={s.loupe}>
      <defs>
        <clipPath id="loupe-clip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <g clipPath="url(#loupe-clip)">
        {/* Solid backing so nothing under the loupe shows through the pixel gaps. */}
        <circle cx={cx} cy={cy} r={r} fill="#0b0b0b" />
        {LOUPE_ROWS.map((fill, row) =>
          Array.from({ length: 8 }, (_, col) => (
            <g key={`${row}-${col}`}>
              <rect x={cx - r + col * cell} y={cy - r + row * cell} width={cell - 1} height={cell - 1} fill={fill} />
              {(row * 3 + col * 5) % 7 === 0 && (
                <rect x={cx - r + col * cell} y={cy - r + row * cell} width={cell - 1} height={cell - 1} fill="#fff" opacity={0.07} />
              )}
            </g>
          )),
        )}
        <line x1={cx} x2={cx} y1={cy - r} y2={cy + r} stroke="#fff" strokeWidth={2} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeWidth={4} />
      <circle cx={cx} cy={cy} r={r + 3} fill="none" className="stroke-foreground" strokeWidth={2} />
    </g>
  );
}

export function SweepFigure() {
  const { x, y, w, h } = FRAME;
  return (
    <Figure label="A divider sweeps across the original and the AVIF, and a loupe shows the pixels either side match.">
      <Dusk />
      <rect x={x} y={y} width={w} height={h} rx={3} className="fill-none stroke-foreground" strokeWidth={2.5} />
      <g className={s.divider}>
        <line x1={x} x2={x} y1={y} y2={y + h} stroke="#fff" strokeWidth={2.5} />
        <circle cx={x} cy={y + h / 2} r={15} className="fill-acid" stroke="#fff" strokeWidth={2.5} />
        <path d={`M${x - 5} ${y + h / 2 - 5} l-5 5 5 5 M${x + 5} ${y + h / 2 - 5} l5 5 -5 5`} className="stroke-acid-foreground" strokeWidth={2} fill="none" />
        <g fontSize={13} fontWeight={500}>
          <rect x={x - 82} y={y + 12} width={72} height={22} rx={3} fill="#000" opacity={0.7} />
          <text x={x - 46} y={y + 27} textAnchor="middle" fill="#fff">
            Before
          </text>
          <rect x={x + 10} y={y + 12} width={64} height={22} rx={3} className="fill-acid" />
          <text x={x + 42} y={y + 27} textAnchor="middle" className="fill-acid-foreground">
            After
          </text>
        </g>
      </g>
      <Loupe cx={x + w / 2} cy={y + h * 0.42} />
    </Figure>
  );
}

export function OfflineFigure() {
  return (
    <Scene>
    <Figure label="A laptop compresses files on its own. The line to a server is cut, and nothing gets through.">
      {/* server */}
      <g className="stroke-muted-foreground" strokeWidth={2.5} fill="none">
        <path d="M430 150 a34 34 0 0 1 8 -66 a46 46 0 0 1 88 8 a30 30 0 0 1 10 58 Z" className="fill-card" strokeDasharray="6 6" />
      </g>
      <text x={486} y={180} textAnchor="middle" fontSize={12} className="fill-muted-foreground">
        server
      </text>

      {/* the line, cut */}
      <line x1={300} y1={250} x2={356} y2={209} className={cn(s.cutLeft, "stroke-foreground")} strokeWidth={2.5} strokeDasharray="7 7" />
      <line x1={378} y1={193} x2={436} y2={150} className={cn(s.cutRight, "stroke-muted-foreground")} strokeWidth={2.5} strokeDasharray="7 7" />
      <g className={s.scissors} transform="translate(367 201)">
        <circle r={22} className="fill-acid" />
        <path d="M-9 -9 9 9 M9 -9 -9 9" className="stroke-acid-foreground" strokeWidth={3} strokeLinecap="round" />
      </g>

      {[0, 1, 2].map((i) => (
        <rect key={i} x={294} y={244} width={12} height={12} rx={2} className={cn(s.packet, "fill-foreground")} style={css({ "--i": i })} />
      ))}

      {/* laptop */}
      <g>
        <rect x={70} y={250} width={240} height={150} rx={10} className="fill-foreground" />
        <rect x={82} y={262} width={216} height={126} rx={4} className="fill-background" />
        <text x={96} y={290} fontSize={14} fontWeight={500} className="fill-foreground font-mono">
          kompress<tspan className="fill-acid">/</tspan>
        </text>
        <rect x={96} y={312} width={188} height={8} rx={4} className="fill-bar-track" />
        <rect x={96} y={312} width={188} height={8} rx={4} className={cn(s.screenBar, "fill-acid")} />
        <text x={96} y={346} fontSize={13} className="fill-muted-foreground">
          on this device
        </text>
        <path d="M40 400 H340 L322 424 H58 Z" className="fill-foreground" />
      </g>
    </Figure>
    </Scene>
  );
}
