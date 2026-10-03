"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { addFiles } from "@/components/workspace/use-add-files";
import { filesFromDataTransfer, filesFromInput } from "@/lib/files";
import type { Incoming } from "@/store/processor";
import { cn } from "@/lib/utils";

/**
 * The hero is a working drop zone. Files are queued straight into the
 * in-memory store, then a client-side navigation opens the workspace, so
 * encoding has already started by the time the queue renders.
 */
export function HeroDrop() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (incoming: Incoming[]) => {
    if (addFiles(incoming)) router.push("/app");
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(await filesFromDataTransfer(e.dataTransfer));
  };

  return (
    <section className="flex p-6 sm:p-10">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-[320px] flex-1 flex-col justify-between border-2 border-dashed p-6 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring rounded-(--control-radius)",
          over ? "border-foreground bg-acid text-acid-foreground" : "border-foreground/35 hover:border-foreground",
        )}
      >
        <span className="label-caps opacity-70">Drop zone</span>
        <span>
          <span className="block text-[clamp(32px,4vw,56px)] leading-[0.95] font-semibold tracking-[-0.03em]">
            {over ? "Let go." : "Drop files or a folder here"}
          </span>
          <span className="mt-3 block text-[14px] font-medium opacity-70">
            or click to choose · JPEG, PNG, WebP, AVIF, JXL, GIF, MP4, MOV, WebM, MKV
          </span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept="image/*,video/*,.heic,.heif,.jxl,.mkv,.mov"
        onChange={(e) => {
          take(filesFromInput(e.target.files));
          e.target.value = "";
        }}
      />
    </section>
  );
}
