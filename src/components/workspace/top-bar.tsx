"use client";

import { Activity, ChevronDown, FolderOpen, Keyboard, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
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
import { canSaveToFolder, downloadAsZip, downloadOne, exportEntries, saveToFolder } from "@/engine/export/export";
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

  const exportAll = async (mode: "zip" | "folder") => {
    const entries = exportEntries(done.map((id) => items[id]));
    if (!entries.length) return;
    try {
      if (mode === "folder") {
        const n = await saveToFolder(entries);
        if (n) toast.success(`Saved ${n} file${n === 1 ? "" : "s"}`);
      } else if (entries.length === 1) downloadOne(entries[0]);
      else await downloadAsZip(entries);
    } catch (err) {
      toast.error("Export failed", { description: err instanceof Error ? err.message : String(err) });
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
            disabled={!done.length}
            onClick={() => exportAll("zip")}
            title={`Export (${mod}S)`}
          >
            {done.length ? `Export ${done.length} file${done.length === 1 ? "" : "s"}` : "Export"}
            {done.length > 0 && <span className="font-medium opacity-60 tnum">{formatBytes(doneBytes)}</span>}
            <span aria-hidden>→</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="acid"
                className="h-[34px] rounded-(--control-radius) border-l border-black/15 px-2"
                disabled={!done.length}
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
