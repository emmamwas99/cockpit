"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { useApolloClient, useQuery } from "@apollo/client/react";
import { FileText, ImageOff, ZoomIn, ZoomOut } from "lucide-react";
import {
  ADMIN_PENDING_SHOP_VERIFICATION_COUNT,
  ADMIN_SHOP_VERIFICATION_COUNTS,
  ADMIN_SHOP_VERIFICATIONS,
} from "@/graphql/operations";
import {
  ShopVerificationIssue,
  ShopVerificationStatus,
  type ShopVerificationDocument,
  type ShopVerificationLocation,
} from "@/graphql/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSocket } from "@/hooks/useSocket";
import { WS_EVENTS } from "@/lib/socket/socket-events";

/** The same blue as the public tick, so admins read it the way buyers do. */
export const VERIFIED_BLUE = "#1D9BF0";

export function VerifiedTick({ className, title = "Verified shop" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={cn("size-4 shrink-0", className)} role="img" aria-label={title}>
      <title>{title}</title>
      <circle cx="10" cy="10" r="10" fill={VERIFIED_BLUE} />
      <path d="M6 10.5l2.5 2.5 5.5-5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STATUS_STYLE: Record<
  ShopVerificationStatus,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  [ShopVerificationStatus.PENDING]: { label: "Waiting", variant: "warning" },
  [ShopVerificationStatus.APPROVED]: { label: "Verified", variant: "success" },
  [ShopVerificationStatus.REJECTED]: { label: "Needs changes", variant: "destructive" },
  [ShopVerificationStatus.REVOKED]: { label: "Removed", variant: "secondary" },
  [ShopVerificationStatus.DRAFT]: { label: "Started", variant: "outline" },
};

export function VerificationStatusBadge({ status }: { status: ShopVerificationStatus }) {
  const style = STATUS_STYLE[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={style.variant}>{style.label}</Badge>;
}

/**
 * The reasons a reviewer can tick, grouped by the part of the form they point
 * at. The seller never sees these labels — the API words each reason for them.
 */
export const ISSUE_GROUPS: { group: string; items: { issue: ShopVerificationIssue; label: string }[] }[] = [
  {
    group: "Business name",
    items: [{ issue: ShopVerificationIssue.BUSINESS_NAME_MISMATCH, label: "Doesn't match the permit" }],
  },
  {
    group: "Business permit",
    items: [
      { issue: ShopVerificationIssue.PERMIT_UNREADABLE, label: "Blurry, cropped or unreadable" },
      { issue: ShopVerificationIssue.PERMIT_EXPIRED, label: "Expired" },
      { issue: ShopVerificationIssue.PERMIT_NOT_VALID, label: "Not a business permit" },
    ],
  },
  {
    group: "Shop photo",
    items: [
      { issue: ShopVerificationIssue.SHOP_PHOTO_NOT_REAL, label: "Logo, product or downloaded image" },
      { issue: ShopVerificationIssue.SHOP_PHOTO_UNCLEAR, label: "Shop isn't clearly visible" },
    ],
  },
  {
    group: "Location",
    items: [
      { issue: ShopVerificationIssue.LOCATION_INCOMPLETE, label: "Missing area, pin or address" },
      { issue: ShopVerificationIssue.LOCATION_MISMATCH, label: "Doesn't match the permit or listings" },
    ],
  },
  {
    group: "Other",
    items: [{ issue: ShopVerificationIssue.OTHER, label: "Something else — explain in your message" }],
  },
];

export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "Bazaar Plaza · Starehe, Nairobi" */
export function placeLine(location?: ShopVerificationLocation | null): string {
  if (!location) return "";
  const place = location.placeName || location.subregion || "";
  const area = [location.placeName ? location.subregion : null, location.county]
    .filter((part) => part && part !== place)
    .join(", ");
  return [place, area].filter(Boolean).join(" · ");
}

export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** A small square preview for tables: the photo, or a PDF mark. */
export function DocumentThumb({
  document,
  label,
  className,
}: {
  document?: ShopVerificationDocument | null;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const base = cn(
    "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-subtle text-muted",
    className,
  );
  if (!document) {
    return (
      <span className={cn(base, "border-dashed")} title={`No ${label.toLowerCase()}`}>
        <span className="sr-only">No {label.toLowerCase()}</span>
      </span>
    );
  }
  if (document.isPdf || !document.contentType.startsWith("image/") || failed || !document.url) {
    return (
      <span className={base} title={label}>
        {document.isPdf ? <FileText className="size-4" /> : <ImageOff className="size-4" />}
      </span>
    );
  }
  return (
    <span className={base} title={label}>
      <img src={document.url} alt={label} className="size-full object-cover" onError={() => setFailed(true)} />
    </span>
  );
}

/**
 * A permit is read, not glanced at: open it large, and let the reviewer flip
 * to actual size to read the small print.
 */
export function DocumentLightbox({
  document,
  title,
  open,
  onOpenChange,
}: {
  document: ShopVerificationDocument | null;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [actualSize, setActualSize] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setActualSize(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[min(1100px,96vw)] max-w-[96vw] flex-col gap-3 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 pr-8">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base">{title}</DialogTitle>
            <DialogDescription className="truncate text-xs">
              {document?.fileName}
              {document ? ` · ${fileSize(document.sizeBytes)}` : ""}
            </DialogDescription>
          </div>
          {document && !document.isPdf && (
            <button
              type="button"
              onClick={() => setActualSize((value) => !value)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] text-foreground hover:bg-subtle"
            >
              {actualSize ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />}
              {actualSize ? "Fit to screen" : "Actual size"}
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-subtle">
          {document?.isPdf ? (
            <iframe src={document.url} title={title} className="size-full rounded-lg bg-white" />
          ) : document ? (
            <img
              src={document.url}
              alt={title}
              onClick={() => setActualSize((value) => !value)}
              className={cn(
                "mx-auto cursor-zoom-in",
                actualSize ? "max-w-none cursor-zoom-out" : "size-full object-contain",
              )}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** How often the Verification badge rechecks for new submissions. */
const POLL_MS = 60_000;

/** Applications waiting for review, for the nav badge and the Waiting tab. */
export function usePendingVerificationCount(): number {
  const { data } = useQuery(ADMIN_PENDING_SHOP_VERIFICATION_COUNT, { fetchPolicy: "cache-first" });
  return data?.adminPendingShopVerificationCount ?? 0;
}

/**
 * Keeps the waiting count fresh across the dashboard — mounted once in the
 * layout, polling while the tab is visible. Decisions refetch it by name.
 */
export function VerificationSync() {
  const client = useApolloClient();
  const { on, onReconnect } = useSocket();

  useQuery(ADMIN_PENDING_SHOP_VERIFICATION_COUNT, {
    pollInterval: POLL_MS,
    skipPollAttempt: () => document.hidden,
  });

  useEffect(
    () =>
      on(WS_EVENTS.ADMIN_VERIFICATION_QUEUE_UPDATED, () => {
        void client.refetchQueries({
          include: [
            ADMIN_PENDING_SHOP_VERIFICATION_COUNT,
            ADMIN_SHOP_VERIFICATION_COUNTS,
            ADMIN_SHOP_VERIFICATIONS,
          ],
        });
      }),
    [on, client],
  );

  useEffect(
    () =>
      onReconnect(() => {
        void client.refetchQueries({
          include: [
            ADMIN_PENDING_SHOP_VERIFICATION_COUNT,
            ADMIN_SHOP_VERIFICATION_COUNTS,
            ADMIN_SHOP_VERIFICATIONS,
          ],
        });
      }),
    [onReconnect, client],
  );
  return null;
}

/** Everything a decision can change, refetched by operation name. */
export const VERIFICATION_REFETCH = [
  "AdminShopVerifications",
  "AdminShopVerificationCounts",
  "AdminPendingShopVerificationCount",
  "AdminShopVerification",
  "AdminUsers",
  "AdminUserCounts",
];
