"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { addFiles } from "@/components/workspace/use-add-files";
import { filesFromDataTransfer, filesFromInput } from "@/lib/files";

const ACCEPT = "image/*,video/*,.heic,.heif,.jxl,.mkv,.mov";

/**
 * The landing page's way in. Files are queued straight into the in-memory
 * store, then a client-side navigation opens the workspace, so encoding has
 * already started by the time the queue renders.
 *
 * Spread `dropProps` on any element to make it a drop target, call `choose()`
 * to open the picker, and render `input` once.
 */
export function useIntake() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  // dragenter/leave fire for every child; count them so `over` doesn't flicker.
  const depth = useRef(0);

  const take = (incoming: Parameters<typeof addFiles>[0]) => {
    if (addFiles(incoming)) router.push("/app");
  };

  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      depth.current++;
      setOver(true);
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    },
    onDrop: async (e: DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      take(await filesFromDataTransfer(e.dataTransfer));
    },
  };

  const input = (
    <input
      ref={ref}
      type="file"
      multiple
      hidden
      accept={ACCEPT}
      onChange={(e) => {
        take(filesFromInput(e.target.files));
        e.target.value = "";
      }}
    />
  );

  return { over, dropProps, choose: () => ref.current?.click(), input };
}
