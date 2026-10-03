"use client";

import { create } from "zustand";
import { DEFAULT_SETTINGS } from "@/engine/settings";
import type { GlobalSettings, ImageSettings, Overrides, QueueItem, VideoSettings } from "@/engine/types";

export type SortKey = "added" | "saved" | "size" | "name";
export type Filter = "all" | "image" | "video" | "failed";

interface WorkspaceState {
  items: Record<string, QueueItem>;
  order: string[];
  global: GlobalSettings;
  selected: string[];
  /** Anchor for shift-click range selection. */
  anchor: string | null;
  quickLookId: string | null;
  /** The keyboard shortcuts sheet. */
  shortcutsOpen: boolean;
  sort: SortKey;
  filter: Filter;

  add(items: QueueItem[]): void;
  patch(id: string, patch: Partial<QueueItem>): void;
  remove(ids: string[]): void;
  clear(): void;

  setImage(patch: Partial<ImageSettings>): void;
  setVideo(patch: Partial<VideoSettings>): void;
  setKeepIfLarger(v: boolean): void;
  setGlobal(g: GlobalSettings): void;
  setOverride(id: string, o: Overrides): void;
  clearOverride(id: string): void;

  select(ids: string[], anchor?: string | null): void;
  setQuickLook(id: string | null): void;
  setShortcutsOpen(open: boolean): void;
  setSort(s: SortKey): void;
  setFilter(f: Filter): void;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  items: {},
  order: [],
  global: DEFAULT_SETTINGS,
  selected: [],
  anchor: null,
  quickLookId: null,
  shortcutsOpen: false,
  sort: "added",
  filter: "all",

  add: (items) =>
    set((s) => {
      const next = { ...s.items };
      for (const it of items) next[it.id] = it;
      return { items: next, order: [...s.order, ...items.map((i) => i.id)] };
    }),
  patch: (id, patch) =>
    set((s) => (s.items[id] ? { items: { ...s.items, [id]: { ...s.items[id], ...patch } } } : s)),
  remove: (ids) =>
    set((s) => {
      const drop = new Set(ids);
      const items = { ...s.items };
      for (const id of ids) delete items[id];
      return {
        items,
        order: s.order.filter((id) => !drop.has(id)),
        selected: s.selected.filter((id) => !drop.has(id)),
        quickLookId: s.quickLookId && drop.has(s.quickLookId) ? null : s.quickLookId,
      };
    }),
  clear: () => set({ items: {}, order: [], selected: [], anchor: null, quickLookId: null }),

  setImage: (patch) =>
    set((s) => ({
      global: {
        ...s.global,
        image: { ...s.global.image, ...patch, resize: { ...s.global.image.resize, ...(patch.resize ?? {}) } },
      },
    })),
  setVideo: (patch) =>
    set((s) => ({
      global: {
        ...s.global,
        video: { ...s.global.video, ...patch, trim: { ...s.global.video.trim, ...(patch.trim ?? {}) } },
      },
    })),
  setKeepIfLarger: (v) => set((s) => ({ global: { ...s.global, keepIfLarger: v } })),
  setGlobal: (g) => set({ global: g }),
  setOverride: (id, o) =>
    set((s) => {
      const it = s.items[id];
      if (!it) return s;
      const overrides: Overrides = {
        image: o.image ? { ...it.overrides.image, ...o.image } : it.overrides.image,
        video: o.video ? { ...it.overrides.video, ...o.video } : it.overrides.video,
      };
      return { items: { ...s.items, [id]: { ...it, overrides } } };
    }),
  clearOverride: (id) =>
    set((s) => (s.items[id] ? { items: { ...s.items, [id]: { ...s.items[id], overrides: {} } } } : s)),

  select: (ids, anchor) => set((s) => ({ selected: ids, anchor: anchor === undefined ? s.anchor : anchor })),
  setQuickLook: (id) => set({ quickLookId: id }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setSort: (sort) => set({ sort }),
  setFilter: (filter) => set({ filter }),
}));

/** Items in display order after sort/filter. */
export function visibleIds(s: Pick<WorkspaceState, "items" | "order" | "sort" | "filter">) {
  let ids = s.order;
  if (s.filter !== "all")
    ids = ids.filter((id) => {
      const it = s.items[id];
      return s.filter === "failed" ? it.status === "failed" : it.kind === s.filter;
    });
  if (s.sort === "added") return ids;
  const val = (it: QueueItem) =>
    s.sort === "saved"
      ? it.output ? 1 - it.output.size / it.file.size : -1
      : s.sort === "size"
        ? it.file.size
        : 0;
  const sorted = [...ids];
  if (s.sort === "name") sorted.sort((a, b) => s.items[a].file.name.localeCompare(s.items[b].file.name));
  else sorted.sort((a, b) => val(s.items[b]) - val(s.items[a]));
  return sorted;
}

export interface Totals {
  count: number;
  done: number;
  failed: number;
  running: number;
  inBytes: number;
  outBytes: number;
  /** Input bytes of finished items only, for an honest saved %. */
  doneInBytes: number;
  progress: number;
}

export function totals(items: Record<string, QueueItem>, order: string[]): Totals {
  const t: Totals = { count: order.length, done: 0, failed: 0, running: 0, inBytes: 0, outBytes: 0, doneInBytes: 0, progress: 0 };
  let prog = 0;
  for (const id of order) {
    const it = items[id];
    t.inBytes += it.file.size;
    if (it.status === "done" && it.output) {
      t.done++;
      t.outBytes += it.output.size;
      t.doneInBytes += it.file.size;
      prog += 1;
    } else if (it.status === "failed" || it.status === "cancelled") {
      t.failed += it.status === "failed" ? 1 : 0;
      prog += 1;
    } else if (it.status === "encoding") {
      t.running++;
      prog += it.progress;
    }
  }
  t.progress = order.length ? prog / order.length : 0;
  return t;
}
