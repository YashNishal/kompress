"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/store/workspace";
import { Kbd } from "./primitives";
import { focusQueue, ignoreKey, SHORTCUTS, useModLabel } from "./shortcuts";

/** The ? sheet: every workspace shortcut, grouped by where it works. */
export function ShortcutsDialog() {
  const open = useWorkspace((s) => s.shortcutsOpen);
  const setOpen = useWorkspace((s) => s.setShortcutsOpen);
  const mod = useModLabel();
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (ignoreKey(e) && !useWorkspace.getState().shortcutsOpen) return;
      e.preventDefault();
      setOpen(!useWorkspace.getState().shortcutsOpen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="flex max-h-[min(88vh,760px)] w-[min(92vw,780px)] max-w-none flex-col gap-0 rounded-(--control-radius) border-rule p-0 sm:max-w-none"
        // Focus the list rather than the close button, so arrows scroll it.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          list.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusQueue();
        }}
      >
        <div className="flex shrink-0 items-baseline gap-3 border-b border-rule px-5 py-3.5 pr-12">
          <DialogTitle className="text-[15px] font-semibold">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            Press <Kbd>?</Kbd> any time to open this list
          </DialogDescription>
        </div>
        <div ref={list} tabIndex={-1} className="min-h-0 gap-x-8 overflow-y-auto px-5 py-4 outline-none sm:columns-2">
          {SHORTCUTS.map((group) => (
            <section key={group.title} className="mb-5 break-inside-avoid last:mb-0">
              <h3 className="label-caps mb-1 text-muted-foreground">{group.title}</h3>
              <ul className="text-[12.5px]">
                {group.items.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-4 border-b border-hair py-1.5">
                    <span>{s.label}</span>
                    <span className="flex shrink-0 items-center text-muted-foreground">
                      {s.keys.map((combo, i) => (
                        <span key={i} className="flex items-center">
                          {i > 0 && <span className="mx-1 text-[11px]">/</span>}
                          {combo.map((key) => (
                            <Kbd key={key} className="mx-px">
                              {key === "mod" ? mod : key}
                            </Kbd>
                          ))}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
