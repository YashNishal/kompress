"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { filesFromInput } from "@/lib/files";
import { Kbd } from "./primitives";
import { makeSamples } from "./samples";
import { addFiles } from "./use-add-files";

/** Empty queue: the whole area is the drop target. Drops themselves are handled window-wide. */
export function QueueEmpty() {
  const input = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  return (
    <section className="flex min-h-0 flex-col p-4" aria-label="Queue">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="group flex flex-1 flex-col items-start justify-end border border-dashed border-foreground/40 p-8 text-left outline-none transition-colors hover:border-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-(--control-radius)"
      >
        <span className="label-caps text-muted-foreground">00 · Empty queue</span>
        <span className="mt-4 text-[clamp(44px,6vw,88px)] font-semibold leading-[0.98] tracking-[-0.035em]">
          Drop images
          <br />
          and videos.
        </span>
        <span className="mt-5 max-w-md text-[14px] font-medium text-muted-foreground">
          Anywhere on this page, or click to choose. Folders keep their structure. Paste with <Kbd>⌘V</Kbd>. Nothing is
          uploaded: every file is encoded on this device.
        </span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept="image/*,video/*,.heic,.heif,.jxl,.mkv,.mov"
        onChange={(e) => {
          addFiles(filesFromInput(e.target.files));
          e.target.value = "";
        }}
      />
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="outline"
          className="h-9 rounded-(--control-radius)"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              addFiles(await makeSamples());
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Drawing samples…" : "Try sample images"}
        </Button>
        <span className="text-[12px] text-muted-foreground">JPEG · PNG · WebP · AVIF · JXL · GIF · MP4 · MOV · WebM · MKV</span>
      </div>
    </section>
  );
}
