"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { Download, ExternalLink, RefreshCw, Users, Video } from "lucide-react";
import { ADMIN_TIKTOK_SAVER_EVENTS, ADMIN_TIKTOK_SAVER_OVERVIEW } from "@/graphql/operations";
import type {
  NamedCount,
  TiktokSaverEvent,
  TiktokSaverEventType,
  TiktokSaverOutcome,
  TiktokSaverOverview,
} from "@/graphql/types";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { webUrl } from "@/lib/web-url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import {
  CountTabs,
  EmptyState,
  ListToolbar,
  PageHeader,
  Segmented,
  StatCard,
  TableSkeleton,
  percentChange,
} from "@/components/shared/page";

/**
 * The public TikTok tools (/tiktok-downloader, MP3, photos) are the site's
 * biggest organic landing pages. This is what people do there: which TikTok
 * posts they save, where they come from, and how many walk on into Shopi.
 */

const RANGES = [
  { key: "1", label: "24 hours" },
  { key: "7", label: "7 days" },
  { key: "28", label: "28 days" },
  { key: "90", label: "3 months" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

type TabKey = "posts" | "creators" | "activity" | "problems";
type Dimension = "source" | "referrer" | "country" | "city" | "device" | "tool" | "locale";

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "referrer", label: "Site" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "device", label: "Device" },
  { key: "tool", label: "Tool" },
  { key: "locale", label: "Language" },
];

const pct = (value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

/** "KE" → 🇰🇪 */
function flag(code?: string | null): string {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** "2026-11-09T14" → "14:00" */
const hourLabel = (bucket: string) => `${bucket.slice(11, 13)}:00`;

export default function TiktokSaverPage() {
  const [range, setRange] = useState<RangeKey>("28");
  const [tab, setTab] = useState<TabKey>("posts");
  const [dimension, setDimension] = useState<Dimension>("source");

  const { data, loading, refetch, networkStatus } = useQuery(ADMIN_TIKTOK_SAVER_OVERVIEW, {
    variables: { days: Number(range) },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const overview = data?.adminTiktokSaverOverview;
  const refreshing = networkStatus === 4;
  const totals = overview?.totals;
  const previous = overview?.previous;
  const compare = RANGES.find((r) => r.key === range)?.label ?? "";
  const problems = totals ? totals.failedLookups + totals.failedDownloads : undefined;

  return (
    <>
      <PageHeader
        title="TikTok downloader"
        description="What people save on the TikTok tool pages, where they come from, and how many go on into Shopi. Signed-out visitors included; bots excluded."
        actions={
          <>
            <Segmented options={[...RANGES]} value={range} onChange={setRange} />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Refresh"
              onClick={() => void refetch()}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={webUrl("/en/tiktok-downloader")} target="_blank" rel="noopener noreferrer">
                Open tool <ExternalLink />
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Files saved"
          value={totals ? formatNumber(totals.downloads) : undefined}
          change={totals && previous ? percentChange(totals.downloads, previous.downloads) : undefined}
          changeSuffix={`vs previous ${compare}`}
          hint={
            totals && totals.failedDownloads > 0
              ? `${formatNumber(totals.failedDownloads)} failed`
              : undefined
          }
        />
        <StatCard
          label="Visitors"
          value={totals ? formatNumber(totals.visitors) : undefined}
          change={totals && previous ? percentChange(totals.visitors, previous.visitors) : undefined}
          changeSuffix="vs previous"
          hint={overview ? `${pct(overview.downloadRate)} saved a file` : undefined}
        />
        <StatCard
          label="Links pasted"
          value={totals ? formatNumber(totals.lookups) : undefined}
          change={totals && previous ? percentChange(totals.lookups, previous.lookups) : undefined}
          changeSuffix="vs previous"
          hint={overview ? `${pct(overview.lookupSuccessRate)} found` : undefined}
        />
        <StatCard
          label="Signups from the tool"
          value={totals ? formatNumber(totals.signups) : undefined}
          change={totals && previous ? percentChange(totals.signups, previous.signups) : undefined}
          changeSuffix="vs previous"
          hint={totals ? `${formatNumber(totals.ctaClicks)} clicks into Shopi` : undefined}
        />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            {overview?.granularity === "hour" ? "By hour" : "By day"}
          </p>
          <p className="text-xs text-muted">Nairobi time</p>
        </div>
        {overview ? (
          <TimeSeriesChart
            dates={overview.series.map((point) => point.bucket)}
            labels={
              overview.granularity === "hour"
                ? overview.series.map((point) => hourLabel(point.bucket))
                : undefined
            }
            series={[
              { name: "Visitors", color: "var(--chart-1)", values: overview.series.map((p) => p.visitors) },
              { name: "Links pasted", color: "var(--chart-accent)", values: overview.series.map((p) => p.lookups) },
              { name: "Files saved", color: "var(--chart-2)", values: overview.series.map((p) => p.downloads) },
            ]}
            height={220}
            valueFormatter={formatNumber}
          />
        ) : (
          <div className="h-[220px] animate-pulse rounded-lg bg-subtle" />
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">Visitors by</p>
            <Segmented options={DIMENSIONS} value={dimension} onChange={setDimension} />
          </div>
          <Breakdown
            rows={overview ? dimensionRows(overview, dimension) : undefined}
            total={totals?.visitors ?? 0}
            flags={dimension === "country"}
            empty={
              dimension === "country" || dimension === "city"
                ? "No location yet. It comes from the web host, so local development has none."
                : "Nothing recorded in this period."
            }
          />
        </Card>
        <div className="grid gap-3">
          <Card className="overflow-hidden">
            <p className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
              What they saved
            </p>
            <Breakdown rows={overview?.byAsset} total={totals?.downloads ?? 0} />
          </Card>
          <Card className="overflow-hidden">
            <p className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
              Clicks into Shopi
            </p>
            <Breakdown rows={overview?.byCta} total={totals?.ctaClicks ?? 0} empty="No clicks yet." />
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <ListToolbar
          tabs={
            <CountTabs
              tabs={[
                { key: "posts" as const, label: "Posts", count: overview?.videoCount },
                { key: "creators" as const, label: "TikTok creators", count: overview?.creatorCount },
                { key: "activity" as const, label: "Activity" },
                { key: "problems" as const, label: "Problems", count: problems, attention: true },
              ]}
              value={tab}
              onChange={setTab}
            />
          }
        />
        {tab === "activity" ? (
          <ActivityLog />
        ) : loading && !overview ? (
          <TableSkeleton />
        ) : !overview ? null : tab === "posts" ? (
          <PostsTable overview={overview} />
        ) : tab === "creators" ? (
          <CreatorsTable overview={overview} />
        ) : (
          <Problems overview={overview} />
        )}
      </Card>

      <p className="text-xs text-placeholder">
        A visitor is one browser tab session. Repeats of the same action within 10 minutes count once.
        Signups are accounts created in the period whose first page on Shopi was a TikTok tool page.
      </p>
    </>
  );
}

function dimensionRows(overview: TiktokSaverOverview, dimension: Dimension): NamedCount[] {
  switch (dimension) {
    case "source":
      return overview.bySource;
    case "referrer":
      return overview.byReferrer;
    case "country":
      return overview.byCountry;
    case "city":
      return overview.byCity;
    case "device":
      return overview.byDevice;
    case "tool":
      return overview.byTool;
    case "locale":
      return overview.byLocale;
  }
}

/** Label, count and share — a thin bar carries the share, the number leads. */
function Breakdown({
  rows,
  total,
  flags = false,
  empty = "Nothing recorded in this period.",
}: {
  rows?: NamedCount[];
  total: number;
  flags?: boolean;
  empty?: string;
}) {
  if (!rows) return <TableSkeleton rows={4} />;
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-[13px] text-muted">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.key} className="px-4 py-2.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-foreground">
              {flags && flag(row.key) ? <span className="mr-1.5">{flag(row.key)}</span> : null}
              {row.label}
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-medium text-foreground">{formatNumber(row.count)}</span>
              {total > 0 && (
                <span className="ml-2 inline-block w-11 text-right text-xs text-muted">
                  {pct(Math.round((row.count / total) * 1000) / 10)}
                </span>
              )}
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-subtle">
            <div
              className="h-1 rounded-full bg-primary/70"
              style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PostsTable({ overview }: { overview: TiktokSaverOverview }) {
  if (overview.topVideos.length === 0) {
    return (
      <EmptyState
        icon={Video}
        title="No TikTok links yet"
        description="Posts appear here as visitors paste links into the downloader."
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Post</TableHead>
          <TableHead className="text-right">Saved</TableHead>
          <TableHead className="text-right">Looked up</TableHead>
          <TableHead className="text-right">Visitors</TableHead>
          <TableHead>Last</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {overview.topVideos.map((video) => (
          <TableRow key={video.key}>
            <TableCell className="max-w-[28rem]">
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-w-0 items-start gap-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground group-hover:underline">
                    {video.title || video.url.replace(/^https:\/\/(www\.)?/, "")}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {video.authorUsername ? `@${video.authorUsername}` : "Unknown creator"}
                    {video.kind === "PHOTO" ? " · Photo post" : ""}
                  </p>
                </div>
                <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted" />
              </a>
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">{formatNumber(video.downloads)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(video.lookups)}</TableCell>
            <TableCell className="text-right tabular-nums text-muted">{formatNumber(video.visitors)}</TableCell>
            <TableCell className="whitespace-nowrap text-muted">{formatRelative(video.lastAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CreatorsTable({ overview }: { overview: TiktokSaverOverview }) {
  if (overview.topCreators.length === 0) {
    return <EmptyState icon={Users} title="No creators yet" />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>TikTok creator</TableHead>
          <TableHead className="text-right">Posts</TableHead>
          <TableHead className="text-right">Saved</TableHead>
          <TableHead className="text-right">Looked up</TableHead>
          <TableHead>Last</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {overview.topCreators.map((creator) => (
          <TableRow key={creator.authorUsername}>
            <TableCell>
              <a
                href={`https://www.tiktok.com/@${creator.authorUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
              >
                @{creator.authorUsername}
                <ExternalLink className="size-3.5 text-muted" />
              </a>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(creator.videos)}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">{formatNumber(creator.downloads)}</TableCell>
            <TableCell className="text-right tabular-nums text-muted">{formatNumber(creator.lookups)}</TableCell>
            <TableCell className="whitespace-nowrap text-muted">{formatRelative(creator.lastAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Problems({ overview }: { overview: TiktokSaverOverview }) {
  const { totals } = overview;
  return (
    <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-border">
      <div>
        <p className="px-4 pt-4 text-[13px] text-muted">Failures by reason</p>
        <Breakdown
          rows={overview.byError}
          total={totals.failedLookups + totals.failedDownloads}
          empty="No failures in this period."
        />
      </div>
      <div className="space-y-3 p-4 text-sm">
        <div className="rounded-lg border border-border p-3">
          <p className="text-[13px] text-muted">Saved through our server (fallback)</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {formatNumber(totals.proxiedDownloads)}
            <span className="ml-2 text-xs font-normal text-muted">
              of {formatNumber(totals.downloads)}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Normally files come straight from TikTok&apos;s CDN. These streamed through the web app
            instead, which spends Vercel bandwidth. A jump here usually means a CDN or CSP change.
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[13px] text-muted">Lookups that failed</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {formatNumber(totals.failedLookups)}
            <span className="ml-2 text-xs font-normal text-muted">of {formatNumber(totals.lookups)}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            &quot;Lookup service busy or down&quot; climbing means the download provider is rate-limiting or
            broken, not that people pasted bad links.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Activity log ─────────────────────────────────────────────────────────────

type ActivityFilter = "all" | "downloads" | "lookups" | "cta" | "errors";
const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "downloads", label: "Saves" },
  { key: "lookups", label: "Lookups" },
  { key: "cta", label: "Clicks into Shopi" },
  { key: "errors", label: "Errors" },
];
const FILTER_VARIABLES: Record<
  ActivityFilter,
  { type?: TiktokSaverEventType; outcome?: TiktokSaverOutcome }
> = {
  all: {},
  downloads: { type: "DOWNLOAD", outcome: "SUCCESS" },
  lookups: { type: "LOOKUP" },
  cta: { type: "CTA_CLICK" },
  errors: { outcome: "ERROR" },
};

const ASSET_WORD: Record<string, string> = {
  VIDEO: "video",
  HD: "HD video",
  AUDIO: "MP3",
  IMAGE: "photo",
  ZIP: "all photos",
};
const ERROR_WORD: Record<string, string> = {
  INVALID_URL: "not a TikTok link",
  UNAVAILABLE: "post unavailable",
  FETCH_FAILED: "lookup service failed",
  SAVE_FAILED: "save failed",
};
const SOURCE_WORD: Record<string, string> = {
  SOCIAL_PROOF: "Homepage",
  SEARCH: "Search",
  AI: "AI assistant",
  SOCIAL: "Social",
  INTERNAL: "Inside Shopi",
  DIRECT: "Direct",
  OTHER: "Other site",
};

function describe(event: TiktokSaverEvent): { text: string; tone: "success" | "secondary" | "destructive" | "default" } {
  if (event.type === "CTA_CLICK") {
    return { text: `Clicked ${event.cta?.replace(/^tool:/, "") ?? "link"}`, tone: "default" };
  }
  if (event.outcome === "ERROR") {
    return { text: `${event.type === "DOWNLOAD" ? "Save" : "Lookup"}: ${ERROR_WORD[event.error ?? ""] ?? "failed"}`, tone: "destructive" };
  }
  if (event.type === "DOWNLOAD") {
    return {
      text: `Saved ${ASSET_WORD[event.asset ?? ""] ?? "file"}${event.delivery === "PROXY" ? " (via server)" : ""}`,
      tone: "success",
    };
  }
  return { text: "Looked up", tone: "secondary" };
}

function ActivityLog() {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const { data, loading, fetchMore } = useQuery(ADMIN_TIKTOK_SAVER_EVENTS, {
    variables: { limit: 50, ...FILTER_VARIABLES[filter] },
    fetchPolicy: "cache-and-network",
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const page = data?.adminTiktokSaverEvents;
  const items = page?.items ?? [];

  const loadMore = async () => {
    if (!page?.nextCursor) return;
    setLoadingMore(true);
    try {
      await fetchMore({
        variables: { after: page.nextCursor },
        updateQuery: (prev, { fetchMoreResult }) =>
          fetchMoreResult
            ? {
                adminTiktokSaverEvents: {
                  ...fetchMoreResult.adminTiktokSaverEvents,
                  items: [
                    ...prev.adminTiktokSaverEvents.items,
                    ...fetchMoreResult.adminTiktokSaverEvents.items,
                  ],
                },
              }
            : prev,
      });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      </div>
      {loading && items.length === 0 ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={Download} title="Nothing yet" description="Events appear here within seconds of happening." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>What</TableHead>
                <TableHead>TikTok post</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Where</TableHead>
                <TableHead>Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((event) => {
                const what = describe(event);
                const link = event.tiktokUrl;
                return (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-muted" title={formatDate(event.createdAt)}>
                      {formatRelative(event.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={what.tone}>{what.text}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[22rem]">
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block min-w-0 hover:underline"
                          title={link}
                        >
                          <span className="block truncate text-foreground">
                            {event.title || link.replace(/^https:\/\/(www\.)?/, "")}
                          </span>
                          {event.authorUsername && (
                            <span className="block truncate text-xs text-muted">@{event.authorUsername}</span>
                          )}
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="text-foreground">{SOURCE_WORD[event.source] ?? event.source}</span>
                      {event.referrerHost && (
                        <span className="block text-xs text-muted">{event.referrerHost}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted">
                      {event.country || event.city ? (
                        <>
                          {flag(event.country)} {[event.city, event.country].filter(Boolean).join(", ")}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted">
                      <span className="capitalize">{event.device}</span>
                      {event.os && event.os !== "Other" ? ` · ${event.os}` : ""}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {page?.hasMore && (
            <div className="flex justify-center border-t border-border p-3">
              <Button size="sm" variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
