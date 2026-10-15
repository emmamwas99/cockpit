"use client";

import { useState } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { toast } from "sonner";
import { AlertTriangle, Clapperboard, Gift, RefreshCw, X } from "lucide-react";
import {
  ADMIN_MARK_REFERRAL_REWARD_PAID,
  ADMIN_REFERRAL_OVERVIEW,
  ADMIN_REFERRAL_REWARDS,
  ADMIN_REFERRALS,
  ADMIN_REJECT_REFERRAL,
  ADMIN_RESTORE_REFERRAL,
} from "@/graphql/operations";
import {
  ReferralRewardStatus,
  ReferralStatus,
  type AdminReferralRewardRow,
  type AdminReferralRow,
  type AdminUser,
  type ReferralFlag,
} from "@/graphql/types";
import { displayName, formatDate, formatKes, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  StatCard,
  TableSkeleton,
} from "@/components/shared/page";
import { SellerPostsSheet } from "@/components/posts/seller-posts";

/**
 * The invite programme: rewards owed (the queue someone works through) and
 * the referred sellers behind them. Every seller's posts open right here with
 * full moderation, so checking "is this seller real?" never means leaving.
 */

const PAGE_SIZE = 20;
const REFETCH = ["AdminReferralOverview", "AdminReferralRewards", "AdminReferrals"];

type RewardFilter = "pending" | "paid" | "cancelled" | "all";
type ReferralFilter = "all" | "pending" | "qualified" | "rejected";

const REWARD_STATUS_OF: Record<RewardFilter, ReferralRewardStatus | undefined> = {
  pending: ReferralRewardStatus.PENDING,
  paid: ReferralRewardStatus.PAID,
  cancelled: ReferralRewardStatus.CANCELLED,
  all: undefined,
};

const REFERRAL_STATUS_OF: Record<ReferralFilter, ReferralStatus | undefined> = {
  all: undefined,
  pending: ReferralStatus.PENDING,
  qualified: ReferralStatus.QUALIFIED,
  rejected: ReferralStatus.REJECTED,
};

const REFERRAL_BADGE: Record<ReferralStatus, { label: string; variant: "secondary" | "success" | "destructive" }> = {
  [ReferralStatus.PENDING]: { label: "Still posting", variant: "secondary" },
  [ReferralStatus.QUALIFIED]: { label: "Qualified", variant: "success" },
  [ReferralStatus.REJECTED]: { label: "Rejected", variant: "destructive" },
};

const REWARD_BADGE: Record<ReferralRewardStatus, { label: string; variant: "warning" | "success" | "secondary" }> = {
  [ReferralRewardStatus.PENDING]: { label: "To pay", variant: "warning" },
  [ReferralRewardStatus.PAID]: { label: "Paid", variant: "success" },
  [ReferralRewardStatus.CANCELLED]: { label: "Withdrawn", variant: "secondary" },
};

const FLAG_LABELS: Record<ReferralFlag, string> = {
  SAME_PHONE_AS_REFERRER: "Same phone as referrer",
  LISTINGS_REMOVED: "Listings since removed",
  REFEREE_SUSPENDED: "Seller suspended",
  REFERRER_SUSPENDED: "Referrer suspended",
};

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}


/** 254712345678 → +254 712 345 678 */
function formatPhone(phone?: string | null): string {
  if (!phone || !/^254\d{9}$/.test(phone)) return phone ?? "—";
  return `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;
}

function UserCell({ user, fallback = "Deleted account" }: { user?: AdminUser | null; fallback?: string }) {
  if (!user) return <span className="text-sm text-muted">{fallback}</span>;
  return (
    <Person
      size="sm"
      name={displayName(user)}
      avatar={user.profile?.avatar}
      secondary={user.username ? `@${user.username}` : (user.email ?? undefined)}
    />
  );
}

function Flags({ flags }: { flags: ReferralFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {flags.map((flag) => (
        <p key={flag} className="flex items-center gap-1 text-xs font-medium text-secondary-strong">
          <AlertTriangle className="size-3" /> {FLAG_LABELS[flag] ?? flag}
        </p>
      ))}
    </div>
  );
}

export default function ReferralsPage() {
  const client = useApolloClient();
  const [view, setView] = useState<"payouts" | "sellers">("payouts");
  const [referrerFilter, setReferrerFilter] = useState<AdminUser | null>(null);
  const [postsOf, setPostsOf] = useState<{ seller: AdminUser; context: string } | null>(null);
  const { data } = useQuery(ADMIN_REFERRAL_OVERVIEW, { fetchPolicy: "cache-and-network" });
  const overview = data?.adminReferralOverview;

  function showSellersOf(referrer: AdminUser) {
    setReferrerFilter(referrer);
    setView("sellers");
  }

  function showPosts(seller: AdminUser | null | undefined, context: string) {
    if (seller) setPostsOf({ seller, context });
  }

  return (
    <>
      <PageHeader
        title="Referrals"
        description={
          overview
            ? `${formatKes(overview.terms.rewardKes)} for each invited seller who reaches ${overview.terms.minListings} live listings.`
            : "Sellers invited by sellers, and the rewards owed for them."
        }
        actions={
          <Button variant="outline" onClick={() => void client.refetchQueries({ include: REFETCH })}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="To pay"
          value={overview ? formatKes(overview.rewardsPendingKes) : undefined}
          hint={overview ? `${overview.rewardsPending} reward${overview.rewardsPending === 1 ? "" : "s"} waiting` : undefined}
        />
        <StatCard
          label="Paid out"
          value={overview ? formatKes(overview.rewardsPaidKes) : undefined}
          hint={overview ? `${overview.rewardsPaid} rewards` : undefined}
        />
        <StatCard
          label="Referred sellers"
          value={overview?.totalReferrals}
          hint={overview ? `from ${overview.referrers} referrer${overview.referrers === 1 ? "" : "s"}` : undefined}
        />
        <StatCard
          label="Qualified"
          value={overview?.qualified}
          hint={
            overview && overview.totalReferrals > 0
              ? `${Math.round((overview.qualified / overview.totalReferrals) * 100)}% of referred sellers`
              : undefined
          }
        />
      </div>

      <Card className="overflow-hidden">
        {view === "payouts" ? (
          <PayoutsView
            tabs={<ViewTabs view={view} onChange={setView} pending={overview?.rewardsPending} total={overview?.totalReferrals} />}
            counts={{ pending: overview?.rewardsPending, paid: overview?.rewardsPaid }}
            onShowSellers={showSellersOf}
            onShowPosts={showPosts}
          />
        ) : (
          <SellersView
            tabs={<ViewTabs view={view} onChange={setView} pending={overview?.rewardsPending} total={overview?.totalReferrals} />}
            counts={{
              all: overview?.totalReferrals,
              pending: overview?.pending,
              qualified: overview?.qualified,
              rejected: overview?.rejected,
            }}
            referrer={referrerFilter}
            onClearReferrer={() => setReferrerFilter(null)}
            onShowSellers={showSellersOf}
            onShowPosts={showPosts}
          />
        )}
      </Card>

      <SellerPostsSheet
        seller={postsOf?.seller ?? null}
        context={postsOf?.context}
        open={!!postsOf}
        onOpenChange={(open) => !open && setPostsOf(null)}
      />
    </>
  );
}

function ViewTabs({
  view,
  onChange,
  pending,
  total,
}: {
  view: "payouts" | "sellers";
  onChange: (view: "payouts" | "sellers") => void;
  pending?: number;
  total?: number;
}) {
  return (
    <CountTabs
      tabs={[
        { key: "payouts" as const, label: "Payouts", count: pending, attention: true },
        { key: "sellers" as const, label: "Referred sellers", count: total },
      ]}
      value={view}
      onChange={onChange}
    />
  );
}

// ── Payouts ──────────────────────────────────────────────────────────────────

function PayoutsView({
  tabs,
  counts,
  onShowSellers,
  onShowPosts,
}: {
  tabs: React.ReactNode;
  counts: { pending?: number; paid?: number };
  onShowSellers: (referrer: AdminUser) => void;
  onShowPosts: (seller: AdminUser | null | undefined, context: string) => void;
}) {
  const [filter, setFilter] = useState<RewardFilter>("pending");
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<AdminReferralRewardRow | null>(null);

  const { data, loading } = useQuery(ADMIN_REFERRAL_REWARDS, {
    variables: { page, limit: PAGE_SIZE, status: REWARD_STATUS_OF[filter] ?? null },
    fetchPolicy: "cache-and-network",
  });
  const rows = data?.adminReferralRewards.data ?? [];
  const meta = data?.adminReferralRewards.meta;

  return (
    <>
      <ListToolbar tabs={tabs}>
        <Segmented
          options={[
            { key: "pending" as const, label: "To pay", count: counts.pending },
            { key: "paid" as const, label: "Paid", count: counts.paid },
            { key: "cancelled" as const, label: "Withdrawn" },
            { key: "all" as const, label: "All" },
          ]}
          value={filter}
          onChange={(key) => {
            setFilter(key);
            setPage(1);
          }}
        />
      </ListToolbar>

      {loading && !data ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Gift}
          title={filter === "pending" ? "Nothing to pay" : "No rewards here"}
          description={filter === "pending" ? "Rewards appear when an invited seller qualifies." : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referrer</TableHead>
              <TableHead>For seller</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>M-Pesa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-44" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const { reward, referrer, referee } = row;
              const badge = REWARD_BADGE[reward.status];
              return (
                <TableRow key={reward.id}>
                  <TableCell>
                    <UserCell user={referrer} />
                    {referrer && (
                      <button
                        type="button"
                        onClick={() => onShowSellers(referrer)}
                        className="mt-1 text-xs font-medium text-primary hover:underline"
                      >
                        All their sellers
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <UserCell user={referee} />
                    <p className="mt-1 text-xs text-muted">
                      {row.liveListingCount} live listing{row.liveListingCount === 1 ? "" : "s"} now
                    </p>
                    <Flags flags={row.flags} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium tabular-nums text-foreground">{formatKes(reward.amountKes)}</p>
                    <p className="text-xs text-muted" title={formatDate(reward.createdAt)}>
                      earned {formatRelative(reward.createdAt)}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {reward.status === ReferralRewardStatus.PAID ? (
                      <>
                        <p className="text-foreground">{formatPhone(reward.paidToPhone)}</p>
                        <p className="font-mono text-xs text-muted">{reward.mpesaReference}</p>
                      </>
                    ) : row.payoutPhone ? (
                      formatPhone(row.payoutPhone)
                    ) : (
                      <span className="text-muted">No number yet</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {reward.status === ReferralRewardStatus.PAID && reward.paidAt && (
                      <p className="mt-1 text-xs text-muted">{formatRelative(reward.paidAt)}</p>
                    )}
                    {reward.status === ReferralRewardStatus.CANCELLED && reward.cancelReason && (
                      <p className="mt-1 max-w-48 text-xs text-muted">{reward.cancelReason}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!referee}
                        onClick={() => onShowPosts(referee, `Invited by ${referrer ? displayName(referrer) : "a deleted account"}`)}
                      >
                        <Clapperboard /> Posts
                      </Button>
                      {reward.status === ReferralRewardStatus.PENDING && (
                        <Button size="sm" onClick={() => setPaying(row)}>
                          Mark paid
                        </Button>
                      )}
                    </div>
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

      <MarkPaidDialog row={paying} onClose={() => setPaying(null)} />
    </>
  );
}

function MarkPaidDialog({ row, onClose }: { row: AdminReferralRewardRow | null; onClose: () => void }) {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [markPaid, { loading }] = useMutation(ADMIN_MARK_REFERRAL_REWARD_PAID, { refetchQueries: REFETCH });

  function close() {
    setReference("");
    setPhone("");
    onClose();
  }

  async function handleConfirm() {
    if (!row) return;
    try {
      await markPaid({
        variables: {
          rewardId: row.reward.id,
          mpesaReference: reference,
          // Blank keeps the number on file.
          phone: phone.trim() || null,
        },
      });
      toast.success("Marked paid — the referrer has been notified");
      close();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && !loading && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record M-Pesa payout</DialogTitle>
          <DialogDescription>
            Send {row ? formatKes(row.reward.amountKes) : ""} to{" "}
            {row?.referrer ? displayName(row.referrer) : "the referrer"} for inviting{" "}
            {row?.referee ? displayName(row.referee) : "this seller"} first, then record it here. They
            get a notification with the M-Pesa code.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mpesa-ref">M-Pesa transaction code</Label>
            <Input
              id="mpesa-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              placeholder="SGR7K2LQ9P"
              autoComplete="off"
              className="font-mono uppercase"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mpesa-phone">Sent to</Label>
            <Input
              id="mpesa-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={row?.payoutPhone ? formatPhone(row.payoutPhone) : "0712 345 678"}
              inputMode="tel"
            />
            <p className="text-xs text-muted">
              {row?.payoutPhone
                ? "Leave blank if you sent it to the number on file."
                : "No number on file — enter the one you paid."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            loading={loading}
            disabled={reference.trim().length < 8 || (!row?.payoutPhone && !phone.trim())}
          >
            Mark paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Referred sellers ─────────────────────────────────────────────────────────

function SellersView({
  tabs,
  counts,
  referrer,
  onClearReferrer,
  onShowSellers,
  onShowPosts,
}: {
  tabs: React.ReactNode;
  counts: { all?: number; pending?: number; qualified?: number; rejected?: number };
  referrer: AdminUser | null;
  onClearReferrer: () => void;
  onShowSellers: (referrer: AdminUser) => void;
  onShowPosts: (seller: AdminUser | null | undefined, context: string) => void;
}) {
  const [filter, setFilter] = useState<ReferralFilter>("all");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<AdminReferralRow | null>(null);

  const { data, loading } = useQuery(ADMIN_REFERRALS, {
    variables: {
      page,
      limit: PAGE_SIZE,
      status: REFERRAL_STATUS_OF[filter] ?? null,
      referrerId: referrer?.id ?? null,
    },
    fetchPolicy: "cache-and-network",
  });
  const [restore] = useMutation(ADMIN_RESTORE_REFERRAL, { refetchQueries: REFETCH });
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const rows = data?.adminReferrals.data ?? [];
  const meta = data?.adminReferrals.meta;

  async function handleRestore(referralId: string) {
    setRestoringId(referralId);
    try {
      await restore({ variables: { referralId } });
      toast.success("Restored and rechecked");
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <>
      <ListToolbar tabs={tabs}>
        {referrer && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-accent-soft py-1 pl-2.5 pr-1 text-[13px] font-medium text-accent">
            Invited by {displayName(referrer)}
            <button
              type="button"
              onClick={() => {
                onClearReferrer();
                setPage(1);
              }}
              aria-label="Show every referrer"
              className="rounded p-0.5 hover:bg-accent/10"
            >
              <X className="size-3.5" />
            </button>
          </span>
        )}
        <Segmented
          options={[
            // Counts are programme-wide, so they only label the unfiltered view.
            { key: "all" as const, label: "All", count: referrer ? undefined : counts.all },
            { key: "pending" as const, label: "Still posting", count: referrer ? undefined : counts.pending },
            { key: "qualified" as const, label: "Qualified", count: referrer ? undefined : counts.qualified },
            { key: "rejected" as const, label: "Rejected", count: referrer ? undefined : counts.rejected },
          ]}
          value={filter}
          onChange={(key) => {
            setFilter(key);
            setPage(1);
          }}
        />
      </ListToolbar>

      {loading && !data ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={Gift} title="No referred sellers here" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Seller</TableHead>
              <TableHead>Invited by</TableHead>
              <TableHead className="text-right">Live listings</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-44" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const { referral, referee, referrer: by } = row;
              const badge = REFERRAL_BADGE[referral.status];
              return (
                <TableRow key={referral.id}>
                  <TableCell>
                    <UserCell user={referee} />
                  </TableCell>
                  <TableCell>
                    <UserCell user={by} />
                    {by && (
                      <button
                        type="button"
                        onClick={() => onShowSellers(by)}
                        className="mt-1 text-xs font-medium text-primary hover:underline"
                      >
                        All their sellers
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="font-medium tabular-nums text-foreground">{row.liveListingCount}</p>
                    {referral.status === ReferralStatus.QUALIFIED &&
                      referral.listingCount !== row.liveListingCount && (
                        <p className="text-xs text-muted">{referral.listingCount} at qualifying</p>
                      )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <Flags flags={row.flags} />
                    {referral.status === ReferralStatus.REJECTED && referral.rejectionReason && (
                      <p className="mt-1 max-w-48 text-xs text-muted">{referral.rejectionReason}</p>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted">
                    <span title={formatDate(referral.createdAt)}>{formatRelative(referral.createdAt)}</span>
                    <p className="text-xs">
                      {referral.source === "CODE" ? `typed code ${referral.code}` : "via link"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!referee}
                        onClick={() => onShowPosts(referee, `Invited by ${by ? displayName(by) : "a deleted account"}`)}
                      >
                        <Clapperboard /> Posts
                      </Button>
                      {referral.status === ReferralStatus.REJECTED ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={restoringId === referral.id}
                          onClick={() => void handleRestore(referral.id)}
                        >
                          Restore
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-error hover:bg-error-soft"
                          onClick={() => setRejecting(row)}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
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

      <RejectDialog row={rejecting} onClose={() => setRejecting(null)} />
    </>
  );
}

function RejectDialog({ row, onClose }: { row: AdminReferralRow | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [reject, { loading }] = useMutation(ADMIN_REJECT_REFERRAL, { refetchQueries: REFETCH });

  function close() {
    setReason("");
    onClose();
  }

  async function handleConfirm() {
    if (!row) return;
    try {
      await reject({ variables: { referralId: row.referral.id, reason } });
      toast.success("Referral rejected");
      close();
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && !loading && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject this referral?</DialogTitle>
          <DialogDescription>
            {row?.referee ? displayName(row.referee) : "This seller"} stops counting for{" "}
            {row?.referrer ? displayName(row.referrer) : "the referrer"}. An unpaid reward for them is
            withdrawn; a paid one is never touched. Only admins see the reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Reason</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Same person as the referrer"
            rows={3}
            maxLength={300}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            loading={loading}
            disabled={reason.trim().length < 3}
          >
            Reject referral
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
