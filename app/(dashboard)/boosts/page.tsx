"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import { ADMIN_BOOSTS, ADMIN_BOOST_COUNTS, ADMIN_CANCEL_BOOST, BOOST_PACKAGES } from "@/graphql/operations";
import { BoostStatus, BoostTier, type AdminContent, type BoostListItem } from "@/graphql/types";
import { displayName, formatDate, formatKes, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import {
  CountTabs,
  EmptyState,
  ListToolbar,
  PageHeader,
  Person,
  Segmented,
  TableSkeleton,
} from "@/components/shared/page";
import { PostCell } from "@/components/posts/post-thumb";
import { PostSheet } from "@/components/posts/post-detail";

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

type TabKey = "active" | "all" | "expired" | "cancelled";

const TABS: { key: TabKey; label: string; status?: BoostStatus }[] = [
  { key: "active", label: "Running", status: BoostStatus.ACTIVE },
  { key: "all", label: "All" },
  { key: "expired", label: "Finished", status: BoostStatus.EXPIRED },
  { key: "cancelled", label: "Ended early", status: BoostStatus.CANCELLED },
];

const STATUS_BADGE: Record<BoostStatus, { label: string; variant: "success" | "secondary" | "warning" }> = {
  [BoostStatus.ACTIVE]: { label: "Running", variant: "success" },
  [BoostStatus.EXPIRED]: { label: "Finished", variant: "secondary" },
  [BoostStatus.CANCELLED]: { label: "Ended early", variant: "warning" },
};


function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function daysLeft(endsAt: string): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / DAY_MS));
}

/** Promoted posts: what is boosted right now, for whom, and until when. */
export default function BoostsPage() {
  const [tabKey, setTabKey] = useState<TabKey>("active");
  const [tier, setTier] = useState<BoostTier | "all">("all");
  const [page, setPage] = useState(1);
  const [ending, setEnding] = useState<BoostListItem | null>(null);
  const [opened, setOpened] = useState<AdminContent | null>(null);
  const tab = TABS.find((t) => t.key === tabKey)!;

  const { data: countData } = useQuery(ADMIN_BOOST_COUNTS, {
    variables: { tier: tier === "all" ? null : tier },
    fetchPolicy: "cache-and-network",
  });
  const counts = countData?.adminBoostCounts;
  const { data, loading } = useQuery(ADMIN_BOOSTS, {
    variables: { page, limit: PAGE_SIZE, status: tab.status ?? null, tier: tier === "all" ? null : tier },
    fetchPolicy: "cache-and-network",
  });
  const { data: packageData } = useQuery(BOOST_PACKAGES);
  const rows = data?.adminBoosts.data ?? [];
  const meta = data?.adminBoosts.meta;
  const packages = packageData?.boostPackages ?? [];

  return (
    <>
      <PageHeader
        title="Boosts"
        description="Promoted posts. To boost one, open a live post and choose Boost."
      />

      {packages.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {packages.map((pkg) => (
            <div key={pkg.tier} className="rounded-xl border border-border bg-elevated px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{pkg.name}</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">{formatKes(pkg.priceKes)}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                ×{pkg.multiplier} reach · {pkg.durationDays} days
              </p>
            </div>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <ListToolbar
          tabs={
            <CountTabs
              tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts?.[t.key] }))}
              value={tabKey}
              onChange={(key) => {
                setTabKey(key);
                setPage(1);
              }}
            />
          }
        >
          <Segmented
            options={[
              { key: "all" as const, label: "All tiers" },
              { key: BoostTier.SILVER, label: "Silver" },
              { key: BoostTier.GOLD, label: "Gold" },
              { key: BoostTier.PLATINUM, label: "Platinum" },
            ]}
            value={tier}
            onChange={(key) => {
              setTier(key);
              setPage(1);
            }}
          />
        </ListToolbar>

        {loading && !data ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title={tabKey === "active" ? "Nothing is boosted right now" : "No campaigns here"}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead className="hidden md:table-cell">Seller</TableHead>
                <TableHead className="hidden sm:table-cell">Package</TableHead>
                <TableHead className="hidden sm:table-cell">Runs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const { boost, content, creator } = row;
                const badge = STATUS_BADGE[boost.status];
                const running = boost.status === BoostStatus.ACTIVE;
                return (
                  <TableRow
                    key={boost.id}
                    className={content ? "cursor-pointer" : undefined}
                    onClick={() => content && setOpened(content)}
                  >
                    <TableCell className="max-w-80">
                      {content ? (
                        <PostCell post={content} />
                      ) : (
                        <span className="text-muted">Post deleted</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-56 md:table-cell">
                      {creator ? (
                        <Person size="sm" name={displayName(creator)} avatar={creator.profile?.avatar} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap sm:table-cell">
                      <span className="font-medium capitalize text-foreground">{boost.tier.toLowerCase()}</span>
                      <span className="text-muted"> · ×{boost.multiplier}</span>
                    </TableCell>
                    <TableCell
                      className="hidden whitespace-nowrap sm:table-cell"
                      title={`${formatDate(boost.startsAt)} – ${formatDate(boost.endsAt)}`}
                    >
                      <p className="text-foreground">
                        {shortDate(boost.startsAt)} – {shortDate(boost.endsAt)}
                      </p>
                      <p className="text-xs text-muted">
                        {running
                          ? `${daysLeft(boost.endsAt)} day${daysLeft(boost.endsAt) === 1 ? "" : "s"} left`
                          : `ended ${formatRelative(boost.endedAt ?? boost.endsAt)}`}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {running && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-error hover:bg-error-soft"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEnding(row);
                          }}
                        >
                          End
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="border-t border-border px-4 pb-3">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <EndBoostDialog row={ending} onClose={() => setEnding(null)} />
      <PostSheet post={opened} open={!!opened} onOpenChange={(open) => !open && setOpened(null)} />
    </>
  );
}

function EndBoostDialog({ row, onClose }: { row: BoostListItem | null; onClose: () => void }) {
  const [cancelBoost, { loading }] = useMutation(ADMIN_CANCEL_BOOST, {
    refetchQueries: ["AdminBoosts", "AdminBoostCounts", "AdminContent"],
  });

  async function handleConfirm() {
    if (!row) return;
    try {
      await cancelBoost({ variables: { boostId: row.boost.id } });
      toast.success("Boost ended");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not end the boost");
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>End this boost now?</DialogTitle>
          <DialogDescription>
            “{row?.content?.title ?? "This post"}” drops back to normal reach straight away
            {row ? `, ${daysLeft(row.boost.endsAt)} days early` : ""}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Keep it running
          </Button>
          <Button variant="destructive" onClick={() => void handleConfirm()} loading={loading}>
            End boost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
