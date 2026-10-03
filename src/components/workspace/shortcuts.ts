"use client";

import { useSyncExternalStore } from "react";

/*
 * Workspace keyboard model. Every view listens on `window`, so shortcuts keep
 * working wherever focus lands (a closed dialog leaves it on <body>). Handlers
 * skip events another handler already claimed via preventDefault, so one key
 * never does two things.
 */

const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable=false])";
/** The keys each kind of native control handles itself; everything else stays a workspace shortcut. */
const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];
const CONTROLS: [selector: string, keys: Set<string>][] = [
  ["[role=slider]", new Set([...ARROWS, "PageUp", "PageDown"])],
  ["[role=radio], [role=tab], [role=option], [role=menuitem], [role=menuitemradio]", new Set([" ", "Enter", ...ARROWS])],
  ["button, a[href], summary, [role=button], [role=checkbox], [role=switch]", new Set([" ", "Enter"])],
];
/** Overlays that take the keyboard: menus, selects, sheets and dialogs (except Quick Look, which opts in). */
const OVERLAY = ["[role=menu]", "[role=listbox]", "[role=dialog]:not([data-quick-look])", "[role=alertdialog]"]
  .map((s) => `${s}:not([data-state=closed])`)
  .join(", ");

/** True when a workspace shortcut should leave this event alone. */
export function ignoreKey(e: KeyboardEvent, { insideQuickLook = false } = {}) {
  if (e.defaultPrevented || e.isComposing) return true;
  const t = e.target instanceof Element ? e.target : null;
  if (t?.closest(EDITABLE)) return true;
  if (document.querySelector(OVERLAY)) return true;
  for (const [selector, keys] of CONTROLS) {
    if (!t?.closest(selector) || !keys.has(e.key)) continue;
    // In Quick Look the only control is the split handle, which needs just ← and →.
    if (!insideQuickLook || e.key === "ArrowLeft" || e.key === "ArrowRight") return true;
  }
  return false;
}

/** ⌘ on Apple platforms, Ctrl elsewhere. */
export function isMod(e: KeyboardEvent | React.KeyboardEvent | React.MouseEvent) {
  return isApple() ? e.metaKey : e.ctrlKey;
}

function isApple() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** "⌘" or "Ctrl" for labels. The server renders "⌘"; the client corrects it after hydration without a mismatch. */
export function useModLabel() {
  return useSyncExternalStore(
    () => () => {},
    () => (isApple() ? "⌘" : "Ctrl"),
    () => "⌘",
  );
}

/** Focus the queue grid so arrow keys have a visible home after an overlay closes. */
export function focusQueue() {
  document.querySelector<HTMLElement>("[role=grid]")?.focus({ preventScroll: true });
}

export type Shortcut = { keys: string[][]; label: string };
export type ShortcutGroup = { title: string; items: Shortcut[] };

/** The one list behind the ? sheet. `mod` is substituted with ⌘ or Ctrl. */
export const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "Queue",
    items: [
      { keys: [["↑"], ["↓"]], label: "Move selection (J and K work too)" },
      { keys: [["⇧", "↑"], ["⇧", "↓"]], label: "Extend selection" },
      { keys: [["Home"], ["End"]], label: "First or last file" },
      { keys: [["mod", "A"]], label: "Select all" },
      { keys: [["Space"]], label: "Quick Look" },
      { keys: [["Enter"]], label: "Open in Compare" },
      { keys: [["R"]], label: "Retry failed or cancelled files" },
      { keys: [["⌫"]], label: "Remove selected" },
      { keys: [["Esc"]], label: "Clear selection" },
    ],
  },
  {
    title: "Quick Look",
    items: [
      { keys: [["↑"], ["↓"]], label: "Previous or next file" },
      { keys: [["1"], ["2"], ["3"], ["4"]], label: "Fit, 2×, 4×, 8×" },
      { keys: [["Enter"]], label: "Open in Compare" },
      { keys: [["Space"], ["Esc"]], label: "Close" },
    ],
  },
  {
    title: "Compare",
    items: [
      { keys: [["←"], ["→"]], label: "Previous or next file" },
      { keys: [["Space"]], label: "Hold to show the original" },
      { keys: [["M"]], label: "Switch mode: split, side by side, diff" },
      { keys: [["1"], ["2"], ["3"], ["4"]], label: "Fit, 2×, 4×, 8×" },
      { keys: [["Esc"]], label: "Back to the queue" },
    ],
  },
  {
    title: "Video timeline",
    items: [
      { keys: [[","], ["."]], label: "Step one frame (⇧ for one second)" },
      { keys: [["I"], ["O"]], label: "Set trim in or out" },
    ],
  },
  {
    title: "Anywhere",
    items: [
      { keys: [["mod", "O"]], label: "Add files" },
      { keys: [["mod", "⇧", "O"]], label: "Add a folder" },
      { keys: [["mod", "V"]], label: "Paste files" },
      { keys: [["mod", "S"]], label: "Export finished files" },
      { keys: [["?"]], label: "Show keyboard shortcuts" },
    ],
  },
];
