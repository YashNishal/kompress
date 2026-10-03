"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { filesFromDataTransfer } from "@/lib/files";
import { useWorkspace } from "@/store/workspace";
import { TopBar } from "./top-bar";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { addFiles } from "./use-add-files";

/**
 * Workspace chrome: top bar, the shortcuts sheet, the window-level ways files
 * arrive (drop anywhere, ⌘V) and the unload guard while jobs are running.
 */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const dragging = useWindowDrop();
  useUnloadGuard();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar />
      {children}
      <ShortcutsDialog />
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-[2px]">
          <div className="flex h-full w-full flex-col items-center justify-center border-2 border-dashed border-foreground">
            <div className="text-[44px] font-semibold leading-none tracking-[-0.03em]">Drop to add</div>
            <div className="mt-3 text-[14px] font-medium text-muted-foreground">Images, videos or whole folders</div>
          </div>
        </div>
      )}
    </div>
  );
}

function hasFiles(e: DragEvent) {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
}

function useWindowDrop() {
  const [dragging, setDragging] = useState(false);
  // dragenter/leave fire for every child element; count them to know when we really left.
  const depth = useRef(0);

  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setDragging(false);
    };
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      addFiles(await filesFromDataTransfer(e.dataTransfer!));
    };
    const paste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      addFiles(files.map((file) => ({ file, path: file.name })));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
  }, []);

  return dragging;
}

function useUnloadGuard() {
  const busy = useWorkspace((s) =>
    s.order.some((id) => {
      const st = s.items[id]?.status;
      return st === "probing" || st === "queued" || st === "encoding";
    }),
  );
  useEffect(() => {
    if (!busy) return;
    const guard = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [busy]);
}
