"use client";

import { useEffect, useState } from "react";
import { detectCapabilities, type Capabilities } from "@/engine/capabilities";

export function useCapabilities(): Capabilities | null {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  useEffect(() => {
    let live = true;
    void detectCapabilities().then((c) => live && setCaps(c));
    return () => {
      live = false;
    };
  }, []);
  return caps;
}
