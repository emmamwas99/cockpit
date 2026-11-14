"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { toast } from "sonner";
import { AlertTriangle, Banknote, CircleDollarSign, RefreshCw, Wallet } from "lucide-react";
import {
  ADMIN_BILLING_SUMMARY,
  ADMIN_COMPLETE_PAYMENT,
  ADMIN_MARK_PAYMENT_FAILED,
  ADMIN_MARK_PAYMENT_REFUNDED,
  ADMIN_MPESA_CALLBACKS,
  ADMIN_PAYMENT_COUNTS,
  ADMIN_PAYMENTS,
  ADMIN_RECHECK_PAYMENT,
  ADMIN_RESOLVE_MPESA_CALLBACK,
} from "@/graphql/operations";
import {
  MpesaCallbackStatus,
  PaymentStatus,
  type AdminMpesaCallback,
  type AdminPayment,
  type AdminPaymentTab,
} from "@/graphql/types";
import { displayName, formatDate, formatKes, formatNumber, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import {
  CountTabs,
  EmptyState,
  ListToolbar,
  PageHeader,
  Person,
  SearchInput,
  StatCard,
  TableSkeleton,
  useDebouncedValue,
} from "@/components/shared/page";

const PAGE_SIZE = 20;
const REFETCH = ["AdminPayments", "AdminPaymentCounts", "AdminBillingSummary", "AdminMpesaCallbacks"];

type TabKey = AdminPaymentTab | "unmatched";

const STATUS_BADGE: Record<
  PaymentStatus,
  { label: string; variant: "success" | "secondary" | "warning" | "destructive" | "default" | "outline" }
> = {
  [PaymentStatus.INITIATED]: { label: "Starting", variant: "secondary" },
  [PaymentStatus.PENDING]: { label: "Waiting for PIN", variant: "default" },
  [PaymentStatus.PAID]: { label: "Paid · delivering", variant: "default" },
  [PaymentStatus.COMPLETED]: { label: "Completed", variant: "success" },
  [PaymentStatus.FAILED]: { label: "Failed", variant: "secondary" },
  [PaymentStatus.NEEDS_REVIEW]: { label: "Needs review", variant: "warning" },
  [PaymentStatus.REFUNDED]: { label: "Refunded", variant: "outline" },
};

const TIER_NAME: Record<string, string> = { silver: "Silver", gold: "Gold", platinum: "Platinum" };

/**
 * M-Pesa payments for boosts. The system settles payments by itself
 * (callback, then STK Query); this page is for watching revenue and for the
 * few that need a person: Needs review, and M-Pesa money that matches no
 * payment.
 */
export default function PaymentsPage() {
  const [tab, setTab] = useState<TabKey>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const [openedId, setOpenedId] = useState<string | null>(null);

  const { data: summaryData } = useQuery(ADMIN_BILLING_SUMMARY, {
    variables: { days: 30 },
    fetchPolicy: "cache-and-network",
  });
  const summary = summaryData?.adminBillingSummary;
  const { data: countData } = useQuery(ADMIN_PAYMENT_COUNTS, {
    variables: { search: debounced || null },
    fetchPolicy: "cache-and-network",
  });
  const counts = countData?.adminPaymentCounts;
  const { data, loading } = useQuery(ADMIN_PAYMENTS, {
    variables: { page, limit: PAGE_SIZE, tab: tab === "unmatched" ? "all" : tab, search: debounced || null },
    skip: tab === "unmatched",
    fetchPolicy: "cache-and-network",
  });
  const rows = data?.adminPayments.data ?? [];
  const meta = data?.adminPayments.meta;
  const opened = rows.find((row) => row.id === openedId) ?? null;

  const successRate =
    summary && summary.started > 0 ? `${Math.round((summary.completed / summary.started) * 100)}%` : "—";

  return (
    <>
      <PageHeader
        title="Payments"
        description="M-Pesa payments for boosts. The system settles them by itself; anything it can't is under Needs review."
        actions={
          summary && (
            <>
              <Badge variant={summary.environment === "production" ? "success" : "warning"}>
                {summary.environment === "production" ? "Live M-Pesa" : "Sandbox"}
              </Badge>
              {!summary.paymentsEnabled && <Badge variant="destructive">Payments off — M-Pesa keys missing</Badge>}
            </>
          )
        }
      />

      {summary && (summary.needsReview > 0 || summary.unmatchedCallbacks > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="size-4 shrink-0 text-secondary-strong" />
          {summary.needsReview > 0 && (
            <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => { setTab("needsReview"); setPage(1); }}>
              {summary.needsReview === 1 ? "1 payment needs review" : `${summary.needsReview} payments need review`}
            </button>
          )}
          {summary.unmatchedCallbacks > 0 && (
            <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => { setTab("unmatched"); setPage(1); }}>
              {summary.unmatchedCallbacks === 1
                ? "1 M-Pesa payment matches no order"
                : `${summary.unmatchedCallbacks} M-Pesa payments match no order`}
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue · 30 days" value={summary ? formatKes(summary.revenueKes) : undefined} hint={summary ? `${formatNumber(summary.completed)} boosts sold` : undefined} />
        <StatCard label="Revenue today" value={summary ? formatKes(summary.revenueTodayKes) : undefined} hint="East Africa Time" />
        <StatCard label="Checkouts · 30 days" value={summary ? formatNumber(summary.started) : undefined} hint={summary ? `${formatNumber(summary.failed)} didn't go through` : undefined} />
        <StatCard label="Paid of started" value={summary ? successRate : undefined} hint="Cancelled and timed-out prompts count against this" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Revenue per day</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1fr_16rem]">
          {summary ? (
            <TimeSeriesChart
              kind="bars"
              dates={summary.daily.map((day) => day.date)}
              series={[{ name: "Revenue", color: "var(--chart-1)", values: summary.daily.map((day) => day.revenueKes) }]}
              valueFormatter={formatKes}
              height={180}
            />
          ) : (
            <Skeleton className="h-45 w-full" />
          )}
          <dl className="divide-y divide-border">
            {(summary?.byItem.length ? summary.byItem : []).map((item) => (
              <div key={item.code} className="flex items-baseline justify-between gap-3 py-2.5">
                <dt className="text-sm text-muted">{TIER_NAME[item.code] ?? item.code}</dt>
                <dd className="text-right text-sm">
                  <span className="font-semibold tabular-nums text-foreground">{formatKes(item.revenueKes)}</span>
                  <span className="block text-xs text-muted">{formatNumber(item.count)} sold</span>
                </dd>
              </div>
            ))}
            {summary && summary.byItem.length === 0 && <p className="py-2.5 text-sm text-muted">No sales in the last 30 days.</p>}
          </dl>
        </CardContent>
      </Card>

      <Card className="overflow-x-clip">
        <ListToolbar
          tabs={
            <CountTabs<TabKey>
              tabs={[
                { key: "all", label: "All", count: counts?.all },
                { key: "needsReview", label: "Needs review", count: counts?.needsReview, attention: (counts?.needsReview ?? 0) > 0 },
                { key: "open", label: "In progress", count: counts?.open },
                { key: "completed", label: "Completed", count: counts?.completed },
                { key: "failed", label: "Failed", count: counts?.failed },
                { key: "refunded", label: "Refunded", count: counts?.refunded },
                { key: "unmatched", label: "Unmatched M-Pesa", count: summary?.unmatchedCallbacks, attention: (summary?.unmatchedCallbacks ?? 0) > 0 },
              ]}
              value={tab}
              onChange={(key) => {
                setTab(key);
                setPage(1);
              }}
            />
          }
        >
          {tab !== "unmatched" && (
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Reference, receipt, phone or user id"
              className="sm:w-80"
            />
          )}
        </ListToolbar>

        {tab === "unmatched" ? (
          <UnmatchedCallbacks />
        ) : loading && !data ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={debounced ? "No payment matches that search" : tab === "needsReview" ? "Nothing needs review" : "No payments here yet"}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment</TableHead>
                <TableHead className="hidden md:table-cell">Seller</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((payment) => {
                const badge = STATUS_BADGE[payment.status];
                return (
                  <TableRow key={payment.id} className="cursor-pointer" onClick={() => setOpenedId(payment.id)}>
                    <TableCell className="max-w-72">
                      <p className="truncate font-mono text-[13px] text-foreground">{payment.reference}</p>
                      <p className="truncate text-xs text-muted">
                        {payment.itemLabel} · {payment.phone}
                      </p>
                    </TableCell>
                    <TableCell className="hidden max-w-56 md:table-cell">
                      {payment.user ? (
                        <Person size="sm" name={displayName(payment.user)} avatar={payment.user.profile?.avatar} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatKes(payment.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted sm:table-cell" title={formatDate(payment.createdAt)}>
                      {formatRelative(payment.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {tab !== "unmatched" && meta && meta.totalPages > 1 && (
          <div className="sticky bottom-0 z-20 border-t border-border bg-elevated/95 px-4 pb-1 backdrop-blur-sm">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <PaymentSheet payment={opened} onClose={() => setOpenedId(null)} />
    </>
  );
}

// ── One payment ─────────────────────────────────────────────────────────────

type ActionKind = "complete" | "refund" | "fail";

function PaymentSheet({ payment, onClose }: { payment: AdminPayment | null; onClose: () => void }) {
  const [action, setAction] = useState<ActionKind | null>(null);
  const [recheck, { loading: rechecking }] = useMutation(ADMIN_RECHECK_PAYMENT, { refetchQueries: REFETCH });

  const p = payment;
  const canRecheck =
    p && !p.moneyReceived && Boolean(p.checkoutRequestId) &&
    [PaymentStatus.PENDING, PaymentStatus.NEEDS_REVIEW, PaymentStatus.FAILED].includes(p.status);
  const canComplete =
    p &&
    ((p.status === PaymentStatus.NEEDS_REVIEW) ||
      (!p.moneyReceived && [PaymentStatus.FAILED, PaymentStatus.PENDING].includes(p.status)));
  const canRefund = p && p.moneyReceived && p.status === PaymentStatus.NEEDS_REVIEW;
  const canFail = p && !p.moneyReceived && p.status === PaymentStatus.NEEDS_REVIEW;

  async function handleRecheck() {
    if (!p) return;
    try {
      const result = await recheck({ variables: { id: p.id } });
      const status = result.data?.adminRecheckPayment.status;
      toast.success(status ? `M-Pesa checked — now ${STATUS_BADGE[status].label.toLowerCase()}` : "Checked with M-Pesa");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check with M-Pesa");
    }
  }

  return (
    <>
      <Sheet open={!!p} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="sm:max-w-[520px]">
          {p && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{p.reference}</SheetTitle>
                <SheetDescription>
                  {p.itemLabel} · {formatKes(p.amount)} · {formatDate(p.createdAt)}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_BADGE[p.status].variant}>{STATUS_BADGE[p.status].label}</Badge>
                  <Badge variant={p.moneyReceived ? "success" : "secondary"}>
                    {p.moneyReceived ? "Money received" : "No money recorded"}
                  </Badge>
                  {p.confirmedVia && <Badge variant="outline">Confirmed by {p.confirmedVia.toLowerCase()}</Badge>}
                </div>

                {p.reviewReason && (
                  <div className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm text-foreground">
                    <p className="font-medium">Why it needs review</p>
                    <p className="mt-0.5 text-muted">{p.reviewReason}</p>
                  </div>
                )}
                {p.failureReason && p.status === PaymentStatus.FAILED && (
                  <p className="rounded-lg bg-subtle px-3 py-2.5 text-sm text-muted">
                    Seller saw: “{p.failureReason}” {p.failureCode && <span className="font-mono">({p.failureCode})</span>}
                  </p>
                )}

                <Section title="Customer">
                  <Field label="Seller">
                    {p.user ? displayName(p.user) : p.userId}
                  </Field>
                  <Field label="Phone">{p.phone}</Field>
                  <Field label="Post">
                    <span className="font-mono text-xs">{p.targetId}</span>
                  </Field>
                </Section>

                <Section title="M-Pesa">
                  <Field label="Receipt">
                    {p.receipt ? (
                      <span className="font-mono">{p.receipt}</span>
                    ) : p.moneyReceived && p.confirmedVia === "QUERY" ? (
                      <span className="text-muted">Not sent — confirmed by status check</span>
                    ) : (
                      "—"
                    )}
                  </Field>
                  <Field label="Amount paid">{p.paidAmount != null ? formatKes(p.paidAmount) : "—"}</Field>
                  <Field label="Paid from">{p.paidPhone ? localPhone(p.paidPhone) : "—"}</Field>
                  <Field label="Result">{p.resultCode ? `${p.resultCode} · ${p.resultDesc ?? ""}` : "—"}</Field>
                  <Field label="CheckoutRequestID">
                    <span className="break-all font-mono text-xs">{p.checkoutRequestId ?? "—"}</span>
                  </Field>
                  <Field label="Prompt sent">{p.stkSentAt ? formatDate(p.stkSentAt) : "—"}</Field>
                  <Field label="Status checks">{formatNumber(p.checkAttempts)}</Field>
                </Section>

                <Section title="Delivery">
                  <Field label="Boost">{p.deliveredRef ? <span className="font-mono text-xs">{p.deliveredRef}</span> : "—"}</Field>
                  <Field label="Attempts">{formatNumber(p.deliveryAttempts)}</Field>
                  {p.deliveryError && <Field label="Last error">{p.deliveryError}</Field>}
                  {p.resolutionNote && <Field label="Admin note">{p.resolutionNote}</Field>}
                </Section>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Timeline</p>
                  <ol className="space-y-3 border-l border-border pl-4">
                    {p.events.map((event, index) => (
                      <li key={`${event.at}-${index}`} className="relative">
                        <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-border-strong" />
                        <p className="text-sm text-foreground">{event.message}</p>
                        <p className="text-xs text-muted">
                          {formatDate(event.at)} · <span className="font-mono">{event.type}</span>
                          {event.actorId ? " · by admin" : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </SheetBody>
              {(canRecheck || canComplete || canRefund || canFail) && (
                <SheetFooter>
                  {canRecheck && (
                    <Button variant="outline" onClick={() => void handleRecheck()} loading={rechecking}>
                      <RefreshCw className="size-4" /> Check with M-Pesa
                    </Button>
                  )}
                  {canComplete && (
                    <Button onClick={() => setAction("complete")}>
                      <CircleDollarSign className="size-4" /> {p.moneyReceived ? "Deliver boost" : "Record payment"}
                    </Button>
                  )}
                  {canRefund && (
                    <Button variant="outline" onClick={() => setAction("refund")}>
                      <Banknote className="size-4" /> Mark refunded
                    </Button>
                  )}
                  {canFail && (
                    <Button variant="ghost" className="text-error hover:bg-error-soft" onClick={() => setAction("fail")}>
                      Mark failed
                    </Button>
                  )}
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
      <ResolveDialog payment={p} action={action} onClose={() => setAction(null)} />
    </>
  );
}

const ACTION_COPY: Record<ActionKind, { title: string; button: string }> = {
  complete: { title: "Record payment and deliver", button: "Deliver boost" },
  refund: { title: "Mark as refunded", button: "Mark refunded" },
  fail: { title: "Mark as failed", button: "Mark failed" },
};

function ResolveDialog({
  payment,
  action,
  onClose,
}: {
  payment: AdminPayment | null;
  action: ActionKind | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState("");
  const [complete, completeState] = useMutation(ADMIN_COMPLETE_PAYMENT, { refetchQueries: REFETCH });
  const [refund, refundState] = useMutation(ADMIN_MARK_PAYMENT_REFUNDED, { refetchQueries: REFETCH });
  const [fail, failState] = useMutation(ADMIN_MARK_PAYMENT_FAILED, { refetchQueries: REFETCH });
  const loading = completeState.loading || refundState.loading || failState.loading;
  const needsReceipt = action === "complete" && payment && !payment.moneyReceived;

  function close() {
    if (loading) return;
    setNote("");
    setReceipt("");
    onClose();
  }

  async function submit() {
    if (!payment || !action) return;
    try {
      if (action === "complete") {
        await complete({ variables: { id: payment.id, note, receipt: needsReceipt ? receipt : null } });
        toast.success("Payment recorded and boost delivered");
      } else if (action === "refund") {
        await refund({ variables: { id: payment.id, note } });
        toast.success("Marked refunded");
      } else {
        await fail({ variables: { id: payment.id, note } });
        toast.success("Marked failed");
      }
      setNote("");
      setReceipt("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the payment");
    }
  }

  const description =
    action === "complete"
      ? needsReceipt
        ? `Only if you found ${formatKes(payment?.amount ?? 0)} for account ${payment?.reference} in the M-Pesa portal. The boost starts at once.`
        : "The money is recorded. This delivers the boost now."
      : action === "refund"
        ? "Send the money back from the M-Pesa portal first, then record it here with the reversal details."
        : "Only after checking the M-Pesa portal shows no payment for this reference.";

  return (
    <Dialog open={!!action} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        {action && (
          <>
            <DialogHeader>
              <DialogTitle>{ACTION_COPY[action].title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {needsReceipt && (
                <div className="space-y-1.5">
                  <Label htmlFor="receipt">M-Pesa receipt</Label>
                  <Input
                    id="receipt"
                    value={receipt}
                    onChange={(event) => setReceipt(event.target.value.toUpperCase())}
                    placeholder="QK12ABC3XY"
                    className="font-mono"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={action === "refund" ? "e.g. Reversed in the portal, ref QX…" : "What you checked and why"}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={close} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant={action === "fail" ? "destructive" : "default"}
                onClick={() => void submit()}
                loading={loading}
                disabled={!note.trim() || (needsReceipt ? !receipt.trim() : false)}
              >
                {ACTION_COPY[action].button}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── M-Pesa money that matches no payment ────────────────────────────────────

function UnmatchedCallbacks() {
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<AdminMpesaCallback | null>(null);
  const [note, setNote] = useState("");
  const { data, loading } = useQuery(ADMIN_MPESA_CALLBACKS, {
    variables: { page, limit: PAGE_SIZE, status: MpesaCallbackStatus.UNMATCHED },
    fetchPolicy: "cache-and-network",
  });
  const [resolve, { loading: saving }] = useMutation(ADMIN_RESOLVE_MPESA_CALLBACK, { refetchQueries: REFETCH });
  const rows = data?.adminMpesaCallbacks.data ?? [];
  const meta = data?.adminMpesaCallbacks.meta;

  async function submit() {
    if (!resolving) return;
    try {
      await resolve({ variables: { id: resolving.id, note } });
      toast.success("Marked as dealt with");
      setResolving(null);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  if (loading && !data) return <TableSkeleton rows={4} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Every M-Pesa payment matches an order"
        description="When money arrives that the system can't link to a checkout, it shows here so nothing is lost."
      />
    );
  }

  return (
    <>
      <p className="border-b border-border px-4 py-3 text-[13px] text-muted">
        M-Pesa took this money but no checkout matches it. Find the seller (by phone), then deliver their boost from
        their failed payment with this receipt, or refund it from the M-Pesa portal.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Receipt</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="hidden sm:table-cell">Received</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-[13px]">{row.receipt ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{row.amount != null ? formatKes(row.amount) : "—"}</TableCell>
              <TableCell>{row.phone ? localPhone(row.phone) : "—"}</TableCell>
              <TableCell className="hidden text-muted sm:table-cell" title={formatDate(row.createdAt)}>
                {formatRelative(row.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => setResolving(row)}>
                  Resolve
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {meta && meta.totalPages > 1 && (
        <div className="border-t border-border px-4 pb-1">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      )}
      <Dialog open={!!resolving} onOpenChange={(open) => !open && !saving && setResolving(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve {resolving?.receipt ?? "payment"}</DialogTitle>
            <DialogDescription>
              Say what happened to this money: delivered to which payment, or refunded with which reversal.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="e.g. Delivered via SHB-K7M2QX9A" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolving(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={saving} disabled={!note.trim()}>
              Mark resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Layout bits ─────────────────────────────────────────────────────────────

/** 254712345678 → 0712 345 678; anything else as given. */
function localPhone(value: string): string {
  if (!/^254\d{9}$/.test(value)) return value;
  const local = `0${value.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <dl className="divide-y divide-border rounded-lg border border-border px-3">{children}</dl>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  );
}
