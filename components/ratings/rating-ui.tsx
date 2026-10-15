"use client";

import { useState } from "react";
import { Compass, ShoppingBag, Star, Store, type LucideIcon } from "lucide-react";
import {
  AppRatingRaterSegment,
  type AdminAppRatingBucket,
  type AdminAppRatingSegmentStat,
} from "@/graphql/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const SEGMENT_META: Record<
  AppRatingRaterSegment,
  { label: string; plural: string; hint: string; icon: LucideIcon; badge: "accent" | "default" | "secondary" }
> = {
  [AppRatingRaterSegment.SELLER]: {
    label: "Seller",
    plural: "Sellers",
    hint: "Has published listings",
    icon: Store,
    badge: "accent",
  },
  [AppRatingRaterSegment.BUYER]: {
    label: "Buyer",
    plural: "Buyers",
    hint: "Has messaged a seller",
    icon: ShoppingBag,
    badge: "default",
  },
  [AppRatingRaterSegment.BROWSER]: {
    label: "Browser",
    plural: "Browsers",
    hint: "Hasn't reached out yet",
    icon: Compass,
    badge: "secondary",
  },
};

export function formatAverage(average: number, count: number): string {
  return count === 0 ? "—" : average.toFixed(1);
}

/** Five stars, filled to the rating. The number is always beside it for screen readers. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          aria-hidden
          className={cn(
            "size-3.5",
            index < Math.round(value)
              ? "fill-secondary text-secondary"
              : "fill-transparent text-border-strong",
          )}
        />
      ))}
    </span>
  );
}

// ── Per-star breakdown ───────────────────────────────────────────────────────

/**
 * App-store style rows, five stars first. One series, so one hue — bar length
 * carries the count and the number sits beside it. Rows are filter buttons.
 */
export function StarBreakdown({
  distribution,
  activeStars,
  onSelect,
}: {
  distribution: number[];
  activeStars: number[] | null;
  onSelect: (stars: number) => void;
}) {
  const max = Math.max(1, ...distribution);
  const total = distribution.reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-1">
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = distribution[stars - 1] ?? 0;
        const active = activeStars?.length === 1 && activeStars[0] === stars;
        const share = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <button
            key={stars}
            type="button"
            onClick={() => onSelect(stars)}
            aria-pressed={active}
            title={`${count} rating${count === 1 ? "" : "s"} at ${stars}★ (${share}%) — click to list them`}
            className={cn(
              "grid w-full grid-cols-[2.25rem_1fr_3.5rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
              active ? "bg-primary-soft" : "hover:bg-subtle",
            )}
          >
            <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
              {stars}
              <Star aria-hidden className="size-3.5 fill-secondary text-secondary" />
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-subtle">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(count / max) * 100}%`, background: "var(--chart-accent)" }}
              />
            </span>
            <span className="text-right text-sm tabular-nums text-muted">
              <span className="font-semibold text-foreground">{formatNumber(count)}</span>
              <span className="ml-1 text-xs">{share}%</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Segment sentiment (diverging) ────────────────────────────────────────────

const SENTIMENT = [
  { key: "unhappy", label: "1–2★", color: "var(--chart-negative)", pick: (d: number[]) => d[0] + d[1] },
  { key: "neutral", label: "3★", color: "var(--chart-midpoint)", pick: (d: number[]) => d[2] },
  { key: "happy", label: "4–5★", color: "var(--chart-positive)", pick: (d: number[]) => d[3] + d[4] },
] as const;

export function SentimentLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      {SENTIMENT.map((part) => (
        <span key={part.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: part.color }} aria-hidden />
          {part.label}
        </span>
      ))}
    </div>
  );
}

/**
 * One row per kind of rater: a 100% bar split unhappy | neutral | happy on the
 * diverging red ↔ gray ↔ blue scale, with every share also written out —
 * the gray midpoint is too faint to be read on color alone.
 */
export function SegmentSentiment({
  segments,
  activeSegment,
  onSelect,
}: {
  segments: AdminAppRatingSegmentStat[];
  activeSegment: AppRatingRaterSegment | null;
  onSelect: (segment: AppRatingRaterSegment) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {segments.map((stat) => {
        const meta = SEGMENT_META[stat.segment];
        const Icon = meta.icon;
        const parts = SENTIMENT.map((part) => {
          const count = part.pick(stat.distribution);
          return { ...part, count, share: stat.count > 0 ? (count / stat.count) * 100 : 0 };
        });
        const active = activeSegment === stat.segment;

        return (
          <button
            key={stat.segment}
            type="button"
            onClick={() => onSelect(stat.segment)}
            aria-pressed={active}
            className={cn(
              "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
              active ? "bg-primary-soft" : "hover:bg-subtle",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="truncate text-sm font-semibold text-foreground">{meta.plural}</span>
                <span className="hidden truncate text-xs text-muted sm:inline">{meta.hint}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted">
                <span className="font-bold text-foreground">{formatAverage(stat.average, stat.count)}</span>
                {stat.count > 0 && <Star aria-hidden className="mb-0.5 ml-0.5 inline size-3.5 fill-secondary text-secondary" />}
                <span className="ml-2 text-xs">
                  {formatNumber(stat.count)} rating{stat.count === 1 ? "" : "s"}
                </span>
              </span>
            </div>

            {stat.count > 0 ? (
              <>
                <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full">
                  {parts
                    .filter((part) => part.count > 0)
                    .map((part) => {
                      const id = `${stat.segment}-${part.key}`;
                      return (
                        <span
                          key={part.key}
                          onMouseEnter={() => setHover(id)}
                          onMouseLeave={() => setHover(null)}
                          title={`${part.label}: ${part.count} (${Math.round(part.share)}%)`}
                          className={cn("h-full transition-opacity", hover && hover !== id && "opacity-60")}
                          style={{ width: `${part.share}%`, background: part.color }}
                        />
                      );
                    })}
                </div>
                <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted">
                  {parts.map((part) => (
                    <span key={part.key}>
                      {part.label} {Math.round(part.share)}%
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted">No ratings from this group yet.</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Average by bucket ────────────────────────────────────────────────────────

/** Average stars per bucket on a fixed 0–5 scale, so buckets compare honestly. */
export function BucketAverages({
  buckets,
  noun,
  empty,
}: {
  buckets: AdminAppRatingBucket[];
  noun: [string, string];
  empty: string;
}) {
  if (buckets.every((bucket) => bucket.count === 0)) {
    return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  }

  return (
    <div className="space-y-3">
      {buckets.map((bucket) => (
        <div key={bucket.key} className="space-y-1.5" title={`${bucket.label}: ${formatAverage(bucket.average, bucket.count)}★ from ${bucket.count}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-foreground">{bucket.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              <span className="font-semibold text-foreground">{formatAverage(bucket.average, bucket.count)}</span>
              {bucket.count > 0 && "★"}
              <span className="ml-2 text-xs">
                {formatNumber(bucket.count)} {bucket.count === 1 ? noun[0] : noun[1]}
              </span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-subtle">
            <div
              className="h-full rounded-full"
              style={{ width: `${(bucket.average / 5) * 100}%`, background: "var(--chart-1)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
