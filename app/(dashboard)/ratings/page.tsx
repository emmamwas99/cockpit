"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import {
  AlertTriangle,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import { ADMIN_APP_RATINGS, ADMIN_APP_RATING_OVERVIEW } from "@/graphql/operations";
import {
  AdminAppRatingSort,
  AppRatingRaterSegment,
  type AdminAppRatingRow,
  type AdminUser,
} from "@/graphql/types";
import { displayName, formatDate, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ComposeTeamMessageDialog } from "@/components/team/compose-team-message-dialog";
import {
  BucketAverages,
  SEGMENT_META,
  SegmentSentiment,
  SentimentLegend,
  StarBreakdown,
  Stars,
  formatAverage,
} from "@/components/ratings/rating-ui";
import { RatingDetailDialog, sellerSignals } from "@/components/ratings/rating-detail-dialog";
import { PageHeader, Segmented } from "@/components/shared/page";

/**
 * How people rate the app, and who they are. The insight cards answer "are we
 * doing well, and for whom?"; the table answers "who said this, and what is
 * their experience of Shopi?" — a seller's shop and listings, a buyer's
 * conversations — so a low rating can be understood and followed up.
 */

const PAGE_SIZE = 20;

const RANGE_OPTIONS = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "180D", days: 180 },
] as const;

const STAR_FILTERS: { key: string; label: string; stars: number[] | null }[] = [
  { key: "all", label: "All stars", stars: null },
  { key: "happy", label: "4–5★", stars: [4, 5] },
  { key: "neutral", label: "3★", stars: [3] },
  { key: "unhappy", label: "1–2★", stars: [1, 2] },
];

const SORT_OPTIONS = [
  { label: "Newest first", value: AdminAppRatingSort.NEWEST },
  { label: "Lowest first", value: AdminAppRatingSort.LOWEST },
  { label: "Highest first", value: AdminAppRatingSort.HIGHEST },
];

function sameStars(a: number[] | null, b: number[] | null): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const SELECT_CLASS = "h-9 rounded-lg border border-border bg-elevated px-3 text-sm text-foreground";

export default function RatingsPage() {
  const [days, setDays] = useState<number>(30);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stars, setStars] = useState<number[] | null>(null);
  const [segment, setSegment] = useState<AppRatingRaterSegment | null>(null);
  const [hasComment, setHasComment] = useState<boolean | null>(null);
  const [sort, setSort] = useState<AdminAppRatingSort>(AdminAppRatingSort.NEWEST);
  const [selected, setSelected] = useState<AdminAppRatingRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [messageTo, setMessageTo] = useState<AdminUser | null>(null);

  // Typing shouldn't fire a query per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const overviewQuery = useQuery(ADMIN_APP_RATING_OVERVIEW, {
    variables: { days },
    fetchPolicy: "cache-and-network",
  });
  const overview = overviewQuery.data?.adminAppRatingOverview;

  const listQuery = useQuery(ADMIN_APP_RATINGS, {
    variables: {
      page,
      limit: PAGE_SIZE,
      stars,
      segment,
      hasComment,
      search: search || null,
      sort,
    },
    fetchPolicy: "cache-and-network",
  });
  const rows = listQuery.data?.adminAppRatings.data ?? [];
  const meta = listQuery.data?.adminAppRatings.meta;

  const filtersActive = !!(stars || segment || hasComment !== null || search);

  function applyStars(next: number[] | null) {
    setStars((current) => (sameStars(current, next) ? null : next));
    setPage(1);
  }

  function applySegment(next: AppRatingRaterSegment | null) {
    setSegment((current) => (current === next ? null : next));
    setPage(1);
  }

  function clearFilters() {
    setStars(null);
    setSegment(null);
    setHasComment(null);
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  function showUnhappy() {
    setStars([1, 2]);
    setSort(AdminAppRatingSort.NEWEST);
    setPage(1);
    document.getElementById("all-ratings")?.scrollIntoView({ behavior: "smooth" });
  }

  function openRow(row: AdminAppRatingRow) {
    setSelected(row);
    setDetailOpen(true);
  }

  function messageRater(rater: AdminUser) {
    // One dialog at a time: close the detail before composing.
    setDetailOpen(false);
    setMessageTo(rater);
  }

  const windowDelta =
    overview && overview.windowCount > 0 && overview.previousWindowCount > 0
      ? Math.round((overview.windowAverage - overview.previousWindowAverage) * 10) / 10
      : null;

  // A single star picked from the breakdown has no chip of its own.
  const customStars =
    stars && !STAR_FILTERS.some((filter) => sameStars(filter.stars, stars)) ? stars : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="App ratings"
        description="Every rating with the person behind it — seller or buyer, their shop and activity."
        actions={
          <>
            <Segmented
              options={RANGE_OPTIONS.map((option) => ({ key: String(option.days), label: option.label }))}
              value={String(days)}
              onChange={(key) => setDays(Number(key))}
            />
            <Button
              variant="outline"
              onClick={() => {
                void overviewQuery.refetch();
                void listQuery.refetch();
              }}
            >
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      {/* ── Headline numbers ─────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Average rating"
          value={overview ? `${formatAverage(overview.allTime.average, overview.allTime.total)} / 5` : undefined}
          hint={
            overview
              ? overview.windowCount > 0
                ? `${overview.windowAverage.toFixed(1)} from ${overview.windowCount} new in the last ${overview.days} days` +
                  (windowDelta !== null
                    ? ` (${windowDelta > 0 ? "↑" : windowDelta < 0 ? "↓" : "→"} ${Math.abs(windowDelta).toFixed(1)} vs the ${overview.days} before)`
                    : "")
                : `No new ratings in the last ${overview.days} days`
              : undefined
          }
        />
        <StatTile
          label="Ratings"
          value={overview ? formatNumber(overview.allTime.total) : undefined}
          hint={
            overview
              ? `${formatNumber(overview.withCommentCount)} with a comment · one per person, editable`
              : undefined
          }
        />
        <StatTile
          label="Satisfied"
          value={overview ? `${overview.satisfiedPercent}%` : undefined}
          hint="Share of ratings at 4 or 5 stars"
        />
        <StatTile
          label="Unhappy"
          value={overview ? formatNumber(overview.unhappyCount) : undefined}
          hint="Rated 1–2 stars — worth a reply"
          action={
            overview && overview.unhappyCount > 0 ? (
              <Button size="sm" variant="outline" onClick={showUnhappy}>
                Review them
              </Button>
            ) : null
          }
        />
      </div>

      {/* ── Insights ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Rating breakdown</CardTitle>
            <CardDescription>All ratings at their current stars. Click a row to list them.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview ? (
              <StarBreakdown
                distribution={overview.allTime.distribution}
                activeStars={stars}
                onSelect={(value) => applyStars([value])}
              />
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle>Who is rating</CardTitle>
              <CardDescription>
                Sellers, buyers and browsers rate the app differently. Click a group to list its ratings.
              </CardDescription>
            </div>
            <SentimentLegend />
          </CardHeader>
          <CardContent>
            {overview ? (
              <SegmentSentiment
                segments={overview.segments}
                activeSegment={segment}
                onSelect={applySegment}
              />
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <Card>
          <CardHeader>
            <CardTitle>New ratings per day</CardTitle>
            <CardDescription>
              First submissions over the last {overview?.days ?? days} days — useful after a release or a prompt change.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview ? (
              overview.windowCount > 0 ? (
                <TimeSeriesChart
                  dates={overview.daily.map((day) => day.date)}
                  series={[
                    {
                      name: "Ratings",
                      color: "var(--chart-accent)",
                      values: overview.daily.map((day) => day.count),
                    },
                  ]}
                  kind="bars"
                  valueFormatter={formatNumber}
                />
              ) : (
                <p className="py-16 text-center text-sm text-muted">No new ratings in this range.</p>
              )
            ) : (
              <Skeleton className="h-56 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What moves the score</CardTitle>
            <CardDescription>Average stars, on a 0–5 scale, by seller traction and by time on Shopi.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {overview ? (
              <>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Sellers, by buyer inquiries
                  </p>
                  <BucketAverages
                    buckets={overview.sellerTraction}
                    noun={["seller", "sellers"]}
                    empty="No seller has rated the app yet."
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Everyone, by time on Shopi when rating
                  </p>
                  <BucketAverages
                    buckets={overview.tenure}
                    noun={["rating", "ratings"]}
                    empty="No ratings yet."
                  />
                </div>
              </>
            ) : (
              <Skeleton className="h-48 w-full md:col-span-2" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Every rating ─────────────────────────────────────────────────── */}
      <Card id="all-ratings" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>Every rating</CardTitle>
          <CardDescription>
            Open one to see the rater in full — their shop, listings and buying activity — and to message them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search comment, name, email or @handle…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Rater type"
                value={segment ?? ""}
                onChange={(event) => {
                  setSegment((event.target.value || null) as AppRatingRaterSegment | null);
                  setPage(1);
                }}
                className={SELECT_CLASS}
              >
                <option value="">All raters</option>
                {Object.values(AppRatingRaterSegment).map((value) => (
                  <option key={value} value={value}>
                    {SEGMENT_META[value].plural}
                  </option>
                ))}
              </select>
              <select
                aria-label="Comment"
                value={hasComment === null ? "" : String(hasComment)}
                onChange={(event) => {
                  setHasComment(event.target.value === "" ? null : event.target.value === "true");
                  setPage(1);
                }}
                className={SELECT_CLASS}
              >
                <option value="">With or without comment</option>
                <option value="true">With a comment</option>
                <option value="false">Stars only</option>
              </select>
              <select
                aria-label="Sort"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as AdminAppRatingSort);
                  setPage(1);
                }}
                className={SELECT_CLASS}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              options={[
                ...STAR_FILTERS.map((filter) => ({ key: filter.key, label: filter.label })),
                // A single star picked from the breakdown shows as its own option.
                ...(customStars ? [{ key: "custom", label: `${customStars.join(", ")}★ only` }] : []),
              ]}
              value={customStars ? "custom" : (STAR_FILTERS.find((f) => sameStars(f.stars, stars))?.key ?? "all")}
              onChange={(key) => {
                const filter = STAR_FILTERS.find((f) => f.key === key);
                if (!filter) return;
                setStars(filter.stars);
                setPage(1);
              }}
            />
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X /> Clear filters
              </Button>
            )}
            {meta && (
              <p className="ml-auto text-xs text-muted">
                {formatNumber(meta.total)} rating{meta.total === 1 ? "" : "s"}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border">
            {listQuery.loading && !listQuery.data ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-12 text-center">
                <Star className="size-6 text-muted" />
                <p className="text-sm text-muted">
                  {filtersActive ? "No ratings match these filters." : "No one has rated Shopi yet."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Rating</TableHead>
                    <TableHead>Rater</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead>Shop &amp; activity</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <RatingRow key={row.rating.id} row={row} onOpen={() => openRow(row)} />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {meta && (
            <div className="sticky bottom-0 z-20 border-t border-border bg-elevated/95 px-4 pb-1 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      <RatingDetailDialog
        row={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onMessage={messageRater}
      />
      <ComposeTeamMessageDialog
        open={!!messageTo}
        onOpenChange={(open) => !open && setMessageTo(null)}
        recipient={messageTo ? { id: messageTo.id, name: displayName(messageTo) } : null}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value?: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] text-muted">{label}</p>
        {action}
      </div>
      {value === undefined ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      )}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function RatingRow({ row, onOpen }: { row: AdminAppRatingRow; onOpen: () => void }) {
  const { rating, rater, shop, segment } = row;
  const name = rater ? displayName(rater) : "Deleted account";
  const signals = shop ? sellerSignals(shop) : [];
  const location = rater?.adminLocation;

  return (
    <TableRow
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer align-top"
    >
      <TableCell className="whitespace-nowrap py-3">
        <Stars value={rating.stars} />
        <p className="mt-1 text-xs text-muted" title={formatDate(rating.createdAt)}>
          {formatRelative(rating.createdAt)}
        </p>
        {row.revisedAt && (
          <p className="text-xs text-muted" title={formatDate(row.revisedAt)}>
            changed {formatRelative(row.revisedAt)}
          </p>
        )}
      </TableCell>

      <TableCell className="py-3">
        <div className="flex min-w-48 items-center gap-2">
          <Avatar src={rater?.profile?.avatar} name={name} className="size-8" />
          <div className="min-w-0">
            <p className={cn("truncate text-sm font-medium", rater ? "text-foreground" : "text-muted")}>{name}</p>
            {rater && (
              <p className="truncate text-xs text-muted">
                {rater.username ? `@${rater.username}` : rater.email ?? rater.id}
              </p>
            )}
          </div>
        </div>
        {(segment || rater?.isVerified || rater?.isSuspended) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {segment && <Badge variant={SEGMENT_META[segment].badge}>{SEGMENT_META[segment].label}</Badge>}
            {rater?.isVerified && <Badge variant="success">Verified</Badge>}
            {rater?.isSuspended && <Badge variant="destructive">Suspended</Badge>}
          </div>
        )}
      </TableCell>

      <TableCell className="py-3">
        {rating.comment ? (
          <p className="line-clamp-3 max-w-sm text-sm text-foreground">{rating.comment}</p>
        ) : (
          <span className="text-sm text-placeholder">Stars only</span>
        )}
      </TableCell>

      <TableCell className="whitespace-nowrap py-3 text-sm">
        {shop ? (
          <>
            <p className="text-foreground">
              <span className="font-semibold">{formatNumber(shop.liveListingCount)}</span> live
              <span className="text-muted"> of {formatNumber(shop.listingCount)} listings</span>
            </p>
            <p className="text-xs text-muted">
              {formatNumber(shop.totalViews)} views · {formatNumber(shop.inquiriesReceived)} inquiries
            </p>
            {signals.length > 0 && (
              <p
                className="mt-0.5 flex items-center gap-1 text-xs font-medium text-secondary-strong"
                title={signals.join("\n")}
              >
                <AlertTriangle className="size-3" aria-hidden />
                {signals.length} thing{signals.length === 1 ? "" : "s"} to check
              </p>
            )}
          </>
        ) : segment === AppRatingRaterSegment.BUYER ? (
          <p className="text-foreground">
            Messaged sellers <span className="font-semibold">{formatNumber(row.conversationsStarted)}</span>×
          </p>
        ) : segment === AppRatingRaterSegment.BROWSER ? (
          <span className="text-muted">No conversations yet</span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </TableCell>

      <TableCell className="whitespace-nowrap py-3 text-sm">
        {location?.county || location?.city ? (
          <>
            <p className="text-foreground">{location.county ?? location.city}</p>
            {(location.ward || location.approximate) && (
              <p className="text-xs text-muted">{location.ward ?? "approx., from IP"}</p>
            )}
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
