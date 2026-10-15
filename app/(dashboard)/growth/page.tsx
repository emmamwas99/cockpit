"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { ADMIN_GROWTH_PULSE } from "@/graphql/operations";
import type { GrowthComparison } from "@/graphql/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { Delta, PageHeader, Segmented, StatCard, percentChange } from "@/components/shared/page";

/**
 * Growth in numbers: pick any day or range and see who signed up and what got
 * posted, against the same length of time just before. Days are UTC, as the
 * API counts them.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "lastMonth" | "custom";

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function presetRange(preset: Exclude<Preset, "custom">): { from: string; to: string } {
  const today = todayUtc();
  switch (preset) {
    case "today":
      return { from: isoDay(today), to: isoDay(today) };
    case "yesterday": {
      const day = new Date(today.getTime() - DAY_MS);
      return { from: isoDay(day), to: isoDay(day) };
    }
    case "7d":
      return { from: isoDay(new Date(today.getTime() - 6 * DAY_MS)), to: isoDay(today) };
    case "30d":
      return { from: isoDay(new Date(today.getTime() - 29 * DAY_MS)), to: isoDay(today) };
    case "month":
      return {
        from: isoDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
        to: isoDay(today),
      };
    case "lastMonth": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      return { from: isoDay(start), to: isoDay(end) };
    }
  }
}

function formatDay(iso: string, withYear = false): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** "2026-10" → "Oct 2026" */
function formatMonth(key: string): string {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function rangeLabel(from: string, to: string): string {
  return from === to ? formatDay(from, true) : `${formatDay(from)} – ${formatDay(to, true)}`;
}

function formatHours(hours?: number | null): string {
  if (hours === null || hours === undefined) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

const DATE_INPUT =
  "h-9 rounded-lg border border-border bg-elevated px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

export default function GrowthPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState(() => presetRange("30d"));
  const [view, setView] = useState<"chart" | "table">("chart");
  const maxDay = isoDay(todayUtc());

  const { data, loading, error } = useQuery(ADMIN_GROWTH_PULSE, {
    variables: { from: range.from, to: range.to, months: 12 },
    fetchPolicy: "cache-and-network",
  });
  const pulse = data?.adminGrowthPulse;

  const comparisons = useMemo(
    () => new Map<string, GrowthComparison>((pulse?.comparisons ?? []).map((c) => [c.key, c])),
    [pulse],
  );
  const stat = (key: string) => comparisons.get(key);
  const previousLabel = pulse
    ? rangeLabel(pulse.previousFrom.slice(0, 10), pulse.previousTo.slice(0, 10))
    : "";

  function pickPreset(next: Preset) {
    setPreset(next);
    if (next !== "custom") setRange(presetRange(next));
  }

  function pickDate(edge: "from" | "to", value: string) {
    if (!value) return;
    setPreset("custom");
    setRange((current) => {
      const next = { ...current, [edge]: value };
      // One end jumping past the other collapses the range to that single day.
      return next.from > next.to ? { from: value, to: value } : next;
    });
  }

  const daily = pulse?.daily ?? [];
  // Newest first, stopping at the first month anything happened — a year of
  // zero rows from before launch says nothing.
  const monthly = pulse?.monthly ?? [];
  const firstActive = monthly.findIndex((m) => m.signups + m.posts + m.postingSellers > 0);
  const months = (firstActive === -1 ? monthly.slice(-1) : monthly.slice(firstActive)).reverse();

  return (
    <>
      <PageHeader title="Growth" description="New people and new listings, for any day or range." />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-elevated p-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          options={[
            { key: "today" as const, label: "Today" },
            { key: "yesterday" as const, label: "Yesterday" },
            { key: "7d" as const, label: "7 days" },
            { key: "30d" as const, label: "30 days" },
            { key: "month" as const, label: "This month" },
            { key: "lastMonth" as const, label: "Last month" },
          ]}
          value={preset === "custom" ? ("" as Preset) : preset}
          onChange={pickPreset}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <input
            type="date"
            aria-label="From"
            value={range.from}
            max={maxDay}
            onChange={(event) => pickDate("from", event.target.value)}
            className={DATE_INPUT}
          />
          <span>to</span>
          <input
            type="date"
            aria-label="To"
            value={range.to}
            max={maxDay}
            onChange={(event) => pickDate("to", event.target.value)}
            className={DATE_INPUT}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-error-soft px-4 py-3 text-sm text-error">{error.message}</p>
      ) : (
        <>
          <p className="text-[13px] text-muted">
            <span className="font-medium text-foreground">{rangeLabel(range.from, range.to)}</span>
            {previousLabel && ` · compared with ${previousLabel}`}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["signups", "Signups"],
                ["posts", "Posts"],
                ["postingSellers", "Sellers who posted"],
                ["newSellers", "First-time sellers"],
              ] as const
            ).map(([key, label]) => {
              const c = stat(key);
              return (
                <StatCard
                  key={key}
                  label={label}
                  loading={loading && !pulse}
                  value={c ? formatNumber(c.current) : undefined}
                  change={c ? percentChange(c.current, c.previous) : undefined}
                  changeSuffix={c ? `vs ${formatNumber(c.previous)}` : undefined}
                />
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Signups and posts per day</CardTitle>
                <Segmented
                  options={[
                    { key: "chart" as const, label: "Chart" },
                    { key: "table" as const, label: "Table" },
                  ]}
                  value={view}
                  onChange={setView}
                />
              </CardHeader>
              <CardContent>
                {loading && !pulse ? (
                  <Skeleton className="h-56 w-full" />
                ) : daily.length < 2 && view === "chart" ? (
                  <p className="py-16 text-center text-sm text-muted">
                    Pick a range of two days or more to see the trend.
                  </p>
                ) : view === "chart" ? (
                  <TimeSeriesChart
                    dates={daily.map((day) => day.key)}
                    series={[
                      { name: "Signups", color: "var(--chart-1)", values: daily.map((day) => day.signups) },
                      { name: "Posts", color: "var(--chart-2)", values: daily.map((day) => day.posts) },
                    ]}
                    valueFormatter={formatNumber}
                    height={240}
                  />
                ) : (
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader className="sticky top-0">
                        <TableRow>
                          <TableHead>Day</TableHead>
                          <TableHead className="text-right">Signups</TableHead>
                          <TableHead className="text-right">Posts</TableHead>
                          <TableHead className="text-right">Sellers posting</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...daily].reverse().map((day) => (
                          <TableRow key={day.key}>
                            <TableCell>{formatDay(day.key, true)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(day.signups)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(day.posts)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(day.postingSellers)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Do new people start selling?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pulse ? (
                  <>
                    <div>
                      <p className="text-2xl font-semibold tabular-nums text-foreground">
                        {pulse.activation.cohortActivationPercent}%
                      </p>
                      <p className="text-[13px] text-muted">
                        of the {formatNumber(pulse.activation.cohortSignups)} people who joined in this range
                        have posted ({formatNumber(pulse.activation.cohortActivated)})
                      </p>
                    </div>
                    <dl className="divide-y divide-border text-sm">
                      <div className="flex justify-between py-2">
                        <dt className="text-muted">Time to first post</dt>
                        <dd className="font-medium tabular-nums">
                          {formatHours(pulse.activation.medianHoursToFirstPost)}
                        </dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted">Posts per seller</dt>
                        <dd className="font-medium tabular-nums">{pulse.activation.postsPerPostingSeller}</dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted">Sellers with 2+ posts</dt>
                        <dd className="font-medium tabular-nums">{formatNumber(pulse.activation.repeatSellers)}</dd>
                      </div>
                      <div className="flex justify-between py-2">
                        <dt className="text-muted">Everyone who has ever posted</dt>
                        <dd className="font-medium tabular-nums">
                          {pulse.activation.lifetimeActivationPercent}%
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <Skeleton className="h-44 w-full" />
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle>Month on month</CardTitle>
            </CardHeader>
            {pulse ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Signups</TableHead>
                    <TableHead className="text-right">vs month before</TableHead>
                    <TableHead className="text-right">Posts</TableHead>
                    <TableHead className="text-right">vs month before</TableHead>
                    <TableHead className="text-right">Sellers posting</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((month, index) => {
                    const before = months[index + 1];
                    const current = index === 0;
                    return (
                      <TableRow key={month.key}>
                        <TableCell className={cn(current && "font-medium")}>
                          {formatMonth(month.key)}
                          {current && <span className="ml-1.5 text-xs font-normal text-muted">so far</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(month.signups)}</TableCell>
                        <TableCell className="text-right">
                          {before ? <Delta change={percentChange(month.signups, before.signups)} /> : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(month.posts)}</TableCell>
                        <TableCell className="text-right">
                          {before ? <Delta change={percentChange(month.posts, before.posts)} /> : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(month.postingSellers)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-4">
                <Skeleton className="h-64 w-full" />
              </div>
            )}
          </Card>

          <p className="text-xs text-placeholder">Days run midnight to midnight UTC (3am to 3am in Nairobi).</p>
        </>
      )}
    </>
  );
}
