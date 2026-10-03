"use client";

import { Activity, ChevronDown, FolderOpen, Keyboard, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  canSaveToFolder,
  downloadAsZip,
  downloadOne,
  exportEntries,
  saveToFolder,
  type ExportProgress,
} from "@/engine/export/export";
import { filesFromInput } from "@/lib/files";
import { formatBytes } from "@/lib/format";
import { MODES } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { addFiles } from "./use-add-files";
import { useWorkspace } from "@/store/workspace";
import { Wordmark } from "./primitives";
import { isMod, useModLabel } from "./shortcuts";

export function TopBar() {
  const pathname = usePathname();
  const order = useWorkspace((s) => s.order);
  const items = useWorkspace((s) => s.items);
  const selected = useWorkspace((s) => s.selected);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const done = order.filter((id) => items[id]?.status === "done");
  const doneBytes = done.reduce((n, id) => n + (items[id].output?.size ?? 0), 0);
  const compareId = selected[0] ?? order[0];
  const onCompare = pathname.startsWith("/app/compare");

  // Fraction written while an export runs, null when idle. Exports are local, so the browser's
  // downloads tab has nothing to show until they finish; this is the only progress the user sees.
  const [exporting, setExporting] = useState<number | null>(null);
  const busy = useRef(false);

  const exportAll = async (mode: "zip" | "folder") => {
    if (busy.current) return;
    const entries = exportEntries(done.map((id) => items[id]));
    if (!entries.length) return;
    if (mode === "zip" && entries.length === 1) {
      downloadOne(entries[0]);
      toast.success(`Downloaded ${entries[0].name.split("/").pop()}`, { description: formatBytes(entries[0].blob.size) });
      return;
    }

    const label = mode === "folder" ? `Saving ${entries.length} files` : `Zipping ${entries.length} files`;
    const id = toast.loading(label, { duration: Infinity });
    let last = 0;
    const onProgress: ExportProgress = (written, total) => {
      const now = performance.now();
      if (now - last < 100 && written < total) return;
      last = now;
      const f = total ? Math.min(written / total, 1) : 0;
      setExporting(f);
      toast.loading(label, {
        id,
        duration: Infinity,
        description: <ExportMeter fraction={f} written={written} total={total} />,
      });
    };

    busy.current = true;
    setExporting(0);
    try {
      if (mode === "folder") {
        const n = await saveToFolder(entries, onProgress);
        if (n) toast.success(`Saved ${n} file${n === 1 ? "" : "s"}`, { id, duration: 4000, description: undefined });
        else toast.dismiss(id);
      } else {
        const saved = await downloadAsZip(entries, onProgress);
        if (saved) toast.success("ZIP ready", { id, duration: 4000, description: `${entries.length} files` });
        else toast.dismiss(id);
      }
    } catch (err) {
      toast.error("Export failed", { id, duration: 6000, description: err instanceof Error ? err.message : String(err) });
    } finally {
      busy.current = false;
      setExporting(null);
    }
  };

  const mod = useModLabel();
  const exportRef = useRef({ exportAll, count: done.length });
  useEffect(() => {
    exportRef.current = { exportAll, count: done.length };
  });
  // File shortcuts work on every workspace page. Checked before the browser's own ⌘O and ⌘S.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isMod(e) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "o") {
        (e.shiftKey ? folderInput : fileInput).current?.click();
      } else if (k === "s" && !e.shiftKey) {
        const { exportAll, count } = exportRef.current;
        if (count) void exportAll("zip");
        else toast("Nothing to export yet", { description: "Files appear here once they finish encoding." });
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-8 bg-chrome px-4 text-chrome-foreground h-[44px] border-b border-hair">
      <Link href="/" className="outline-none focus-visible:ring-2 focus-visible:ring-acid" aria-label="Kompress home">
        <Wordmark />
      </Link>

      <nav className="flex gap-6 text-[13px] font-medium" aria-label="Workspace">
        <NavLink href="/app" n="01" active={pathname === "/app"}>
          Queue
        </NavLink>
        <NavLink href={compareId ? `/app/compare/${compareId}` : "#"} n="02" active={onCompare} disabled={!compareId}>
          Compare
        </NavLink>
      </nav>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-[34px] rounded-(--control-radius) text-chrome-muted hover:bg-accent hover:text-chrome-foreground"
          onClick={() => useWorkspace.getState().setShortcutsOpen(true)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard />
        </Button>
        <ThemeMenu />
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept="image/*,video/*,.heic,.heif,.jxl,.mkv,.mov"
          onChange={(e) => {
            addFiles(filesFromInput(e.target.files));
            e.target.value = "";
          }}
        />
        <input
          ref={folderInput}
          type="file"
          hidden
          // @ts-expect-error non-standard but universally supported
          webkitdirectory=""
          onChange={(e) => {
            addFiles(filesFromInput(e.target.files));
            e.target.value = "";
          }}
        />
        <div className="flex">
          <Button
            variant="chrome"
            className="h-[34px] rounded-(--control-radius) px-3.5"
            onClick={() => fileInput.current?.click()}
            title={`Add files (${mod}O)`}
          >
            Add files
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="chrome" className="h-[34px] rounded-(--control-radius) px-2" aria-label="More ways to add">
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={() => folderInput.current?.click()}>
                <FolderOpen /> Add a folder…
                <DropdownMenuShortcut>⇧{mod}O</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex">
          <Button
            variant="acid"
            className="h-[34px] rounded-(--control-radius) px-3.5"
            disabled={!done.length || exporting !== null}
            onClick={() => exportAll("zip")}
            title={`Export (${mod}S)`}
          >
            {exporting !== null ? (
              <span className="tnum">Exporting {Math.round(exporting * 100)}%</span>
            ) : (
              <>
                {done.length ? `Export ${done.length} file${done.length === 1 ? "" : "s"}` : "Export"}
                {done.length > 0 && <span className="font-medium opacity-60 tnum">{formatBytes(doneBytes)}</span>}
                <span aria-hidden>→</span>
              </>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="acid"
                className="h-[34px] rounded-(--control-radius) border-l border-black/15 px-2"
                disabled={!done.length || exporting !== null}
                aria-label="Export options"
              >
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onSelect={() => exportAll("zip")}>
                {done.length === 1 ? "Download file" : "Download as ZIP"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!canSaveToFolder()} onSelect={() => exportAll("folder")}>
                Save into a folder…
                {!canSaveToFolder() && <span className="ml-auto text-[11px] text-muted-foreground">Chrome/Edge</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function ExportMeter({ fraction, written, total }: { fraction: number; written: number; total: number }) {
  return (
    <div className="mt-1.5 grid w-56 gap-1">
      <div
        className="h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
      >
        <div className="h-full bg-acid transition-[width] duration-100" style={{ width: `${fraction * 100}%` }} />
      </div>
      <span className="text-[11px] tnum text-muted-foreground">
        {formatBytes(written)} of {formatBytes(total)} · {Math.round(fraction * 100)}%
      </span>
    </div>
  );
}

function NavLink({
  href,
  n,
  active,
  disabled,
  children,
}: {
  href: string;
  n: string;
  active: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled)
    return (
      <span className="cursor-not-allowed text-chrome-muted/50">
        <span className="mr-1.5 font-normal">{n}</span>
        {children}
      </span>
    );
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "outline-none transition-colors focus-visible:text-chrome-foreground",
        active ? "text-chrome-foreground" : "text-chrome-muted hover:text-chrome-foreground",
      )}
    >
      <span className={cn("mr-1.5 font-normal", active ? "text-acid" : "text-chrome-muted/60")}>{n}</span>
      {children}
    </Link>
  );
}

/** Light, dark, phosphor or system. */
function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="mr-1 size-[34px] rounded-(--control-radius) text-chrome-muted hover:bg-accent hover:text-chrome-foreground"
          aria-label="Theme"
          title="Theme"
        >
          {/* CSS picks the icon, so the server and client render the same markup. */}
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block phosphor:hidden" />
          <Activity className="hidden phosphor:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {MODES.map((m) => (
            <DropdownMenuRadioItem key={m.value} value={m.value}>
              {m.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
