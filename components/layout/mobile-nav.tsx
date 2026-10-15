"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Brand, NavLinks, useNavCounts } from "./sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const counts = useNavCounts();
  const waiting = counts.pendingReview + counts.teamUnread;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative md:hidden"
          aria-label={waiting > 0 ? `Open menu, ${waiting} items waiting` : "Open menu"}
        >
          <Menu />
          {/* The menu hides behind this button on phones, so flag its badges here. */}
          {waiting > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" />}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-72 sm:max-w-72">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex h-14 shrink-0 items-center px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6 pt-2">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
