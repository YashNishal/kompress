"use client";

import { toast } from "sonner";
import { ingest, type Incoming } from "@/store/processor";

/** Adds files and tells the user, specifically, about anything skipped. */
export function addFiles(incoming: Incoming[]) {
  if (!incoming.length) return;
  const { added, skipped } = ingest(incoming);
  if (skipped.length) {
    const names = skipped.slice(0, 3).join(", ") + (skipped.length > 3 ? ` and ${skipped.length - 3} more` : "");
    toast(`Skipped ${skipped.length} unsupported file${skipped.length === 1 ? "" : "s"}`, {
      description: `${names}. Kompress handles images and videos.`,
    });
  }
  return added;
}
