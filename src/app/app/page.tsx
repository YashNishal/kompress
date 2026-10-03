"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Inspector } from "@/components/workspace/inspector";
import { QuickLook } from "@/components/workspace/quick-look";
import { QueueTable } from "@/components/workspace/queue-table";
import { StatsBand } from "@/components/workspace/stats-band";

export default function QueuePage() {
  return (
    <>
      <StatsBand />
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
        <QueueTable />
        <aside className="hidden min-h-0 overflow-y-auto border-l border-rule xl:block" aria-label="Settings">
          <Inspector />
        </aside>
      </div>

      <QuickLook />

      {/* Below 1280px the inspector becomes a drawer. */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="acid" className="fixed bottom-5 right-5 z-40 h-10 rounded-(--control-radius) px-4 shadow-lg xl:hidden">
            <SlidersHorizontal /> Settings
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[340px] gap-0 overflow-y-auto p-0 sm:max-w-[340px]">
          <SheetTitle className="sr-only">Settings</SheetTitle>
          <Inspector />
        </SheetContent>
      </Sheet>
    </>
  );
}
