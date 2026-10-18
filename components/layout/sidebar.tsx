"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePendingReviewCount } from "@/components/posts/pending-review-sync";
import { usePendingVerificationCount } from "@/components/verification/verification-ui";
import { useTeamUnreadThreads } from "@/components/team/team-inbox-sync";
import { NAV_SECTIONS, isActive, type NavItem } from "./nav";

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <img src="/icon.svg" alt="" width={28} height={28} className="size-7 shrink-0" />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        Shopi <span className="font-normal text-muted">Admin</span>
      </span>
    </Link>
  );
}

export function useNavCounts(): Record<NonNullable<NavItem["badge"]>, number> {
  return {
    pendingReview: usePendingReviewCount(),
    pendingVerification: usePendingVerificationCount(),
    teamUnread: useTeamUnreadThreads(),
  };
}

const BADGE_LABEL: Record<NonNullable<NavItem["badge"]>, string> = {
  pendingReview: "posts waiting for review",
  pendingVerification: "shops waiting for verification",
  teamUnread: "Shopi team threads with unread messages",
};

/** The menu itself — shared by the desktop sidebar and the mobile drawer. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const counts = useNavCounts();

  return (
    <nav className="space-y-5">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.label ?? index}>
          {section.label && (
            <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-placeholder">
              {section.label}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon, badge }) => {
              const active = isActive(href, pathname);
              const count = badge ? counts[badge] : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                    active
                      ? "bg-primary-soft font-medium text-primary-strong"
                      : "text-muted hover:bg-subtle hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                  {count > 0 && (
                    <span className="ml-auto rounded-md bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-on-brand">
                      {count > 99 ? "99+" : count}
                      <span className="sr-only"> {badge ? BADGE_LABEL[badge] : ""}</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-elevated md:flex">
      <div className="flex h-14 shrink-0 items-center px-5">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6 pt-2">
        <NavLinks />
      </div>
    </aside>
  );
}
