"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@apollo/client/react";
import { Flag, Megaphone, MessagesSquare } from "lucide-react";
import {
  ADMIN_CONVERSATIONS,
  ADMIN_CONVERSATION_ANALYTICS,
  ADMIN_CONVERSATION_COUNTS,
} from "@/graphql/operations";
import type {
  AdminConversationCounts,
  AdminConversationQueue,
  AdminConversationSummary,
  AdminUser,
} from "@/graphql/types";
import { displayName, formatDate, formatNumber, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
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
import { PostCell } from "@/components/posts/post-thumb";
import { ComposeTeamMessageDialog } from "@/components/team/compose-team-message-dialog";

const PAGE_SIZE = 20;

const QUEUES: {
  key: AdminConversationQueue;
  label: string;
  countKey: keyof AdminConversationCounts;
  attention?: boolean;
}[] = [
  { key: "ALL", label: "All", countKey: "all" },
  { key: "SELLER_NEEDS_REPLY", label: "Seller owes reply", countKey: "sellerNeedsReply", attention: true },
  { key: "BUYER_NEEDS_REPLY", label: "Buyer owes reply", countKey: "buyerNeedsReply" },
  { key: "REPORTED", label: "Reported", countKey: "reported", attention: true },
  { key: "OPEN_DEALS", label: "Open", countKey: "openDeals" },
  { key: "CLOSED_DEALS", label: "Deal closed", countKey: "closedDeals" },
];

function pretty(value?: string | null): string {
  if (!value) return "";
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 18 → "18 min", 210 → "3.5 h", 3000 → "2.1 days". */
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 24) return `${Math.round((minutes / 60) * 10) / 10} h`;
  return `${Math.round((minutes / 60 / 24) * 10) / 10} days`;
}

function senderOf(item: AdminConversationSummary): string {
  const sender = item.conversation.lastMessageSenderId;
  if (!sender) return "";
  if (sender === item.conversation.sellerId) return "Seller";
  if (sender === item.conversation.buyerId) return "Buyer";
  return "";
}

export default function ConversationsPage() {
  return (
    <Suspense>
      <ConversationsScreen />
    </Suspense>
  );
}

function ConversationsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const queue = (QUEUES.find((q) => q.key === params.get("queue"))?.key ?? "ALL") as AdminConversationQueue;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [opened, setOpened] = useState<AdminConversationSummary | null>(null);
  const [messageTo, setMessageTo] = useState<AdminUser | null>(null);

  const { data: analyticsData } = useQuery(ADMIN_CONVERSATION_ANALYTICS, {
    variables: { days: 30 },
    fetchPolicy: "cache-and-network",
  });
  const analytics = analyticsData?.adminConversationAnalytics;
  const { data: countData } = useQuery(ADMIN_CONVERSATION_COUNTS, {
    variables: { search: search || null },
    fetchPolicy: "cache-and-network",
  });
  const counts = countData?.adminConversationCounts;
  const { data, loading } = useQuery(ADMIN_CONVERSATIONS, {
    variables: { page, limit: PAGE_SIZE, queue, search: search || null },
    fetchPolicy: "cache-and-network",
  });
  const rows = data?.adminConversations.data ?? [];
  const meta = data?.adminConversations.meta;

  function switchQueue(key: AdminConversationQueue) {
    router.replace(`/conversations?queue=${key}`, { scroll: false });
    setPage(1);
  }

  return (
    <>
      <PageHeader title="Conversations" description="Buyers and sellers talking about listings." />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Sellers who reply within a day"
          value={analytics ? `${analytics.sellerReplyRate24hPercent}%` : undefined}
          hint={analytics ? `${analytics.sellerReplyRate1hPercent}% within an hour · last 30 days` : undefined}
        />
        <StatCard
          label="Median first reply"
          value={analytics ? formatMinutes(analytics.medianSellerFirstResponseMinutes) : undefined}
          hint="Seller's first answer to a buyer · last 30 days"
        />
        <StatCard
          label="Deals closed"
          value={analytics ? formatNumber(analytics.closedDeals) : undefined}
          hint={analytics ? `from ${formatNumber(analytics.startedInWindow)} new conversations · last 30 days` : undefined}
        />
      </div>

      <Card className="overflow-x-clip">
        <ListToolbar
          tabs={
            <CountTabs
              tabs={QUEUES.map((q) => ({
                key: q.key,
                label: q.label,
                count: counts?.[q.countKey],
                attention: q.attention,
              }))}
              value={queue}
              onChange={switchQueue}
            />
          }
        >
          <SearchInput
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              setPage(1);
            }}
            placeholder="Buyer, seller, listing or message"
          />
        </ListToolbar>

        {loading && !data ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState icon={MessagesSquare} title={search ? "No conversations match" : "Nothing in this queue"} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Listing</TableHead>
                <TableHead className="hidden lg:table-cell">Buyer</TableHead>
                <TableHead className="hidden lg:table-cell">Seller</TableHead>
                <TableHead>Last message</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Messages</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const { conversation } = item;
                const sender = senderOf(item);
                return (
                  <TableRow key={conversation.id} className="cursor-pointer" onClick={() => setOpened(item)}>
                    <TableCell className="max-w-72">
                      {item.content ? (
                        <PostCell post={item.content} />
                      ) : (
                        <span className="text-muted">Listing deleted</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-44 lg:table-cell">
                      <Person size="sm" name={displayName(item.buyer)} avatar={item.buyer?.profile?.avatar} />
                    </TableCell>
                    <TableCell className="hidden max-w-44 lg:table-cell">
                      <Person size="sm" name={displayName(item.seller)} avatar={item.seller?.profile?.avatar} />
                    </TableCell>
                    <TableCell className="max-w-80">
                      <p className="truncate text-foreground">
                        {sender && <span className="text-muted">{sender}: </span>}
                        {conversation.lastMessageText || pretty(conversation.lastMessageType) || "—"}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {conversation.lastMessageAt && <span>{formatRelative(conversation.lastMessageAt)}</span>}
                        {item.needsSellerReply && <Badge variant="warning">Seller owes reply</Badge>}
                        {item.needsBuyerReply && <Badge variant="secondary">Buyer owes reply</Badge>}
                        {item.isReported && (
                          <Badge variant="destructive">
                            <Flag /> Reported
                          </Badge>
                        )}
                        {item.dealClosed && <Badge variant="success">Deal closed</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted sm:table-cell">
                      {formatNumber(conversation.messageCount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="sticky bottom-0 z-20 border-t border-border bg-elevated/95 px-4 pb-1 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <ConversationSheet item={opened} onClose={() => setOpened(null)} onMessage={setMessageTo} />
      <ComposeTeamMessageDialog
        open={!!messageTo}
        onOpenChange={(open) => !open && setMessageTo(null)}
        recipient={messageTo ? { id: messageTo.id, name: displayName(messageTo) } : null}
      />
    </>
  );
}

function Party({
  role,
  user,
  unread,
  onMessage,
}: {
  role: string;
  user?: AdminUser | null;
  unread: number;
  onMessage: (user: AdminUser) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-xs text-muted">
          {role}
          {unread > 0 && ` · ${unread} unread`}
        </p>
        <Person
          name={user ? displayName(user) : "Deleted account"}
          avatar={user?.profile?.avatar}
          secondary={user?.email ?? (user?.username ? `@${user.username}` : undefined)}
        />
      </div>
      {user && (
        <Button size="sm" variant="outline" onClick={() => onMessage(user)}>
          <Megaphone /> Message
        </Button>
      )}
    </div>
  );
}

function ConversationSheet({
  item,
  onClose,
  onMessage,
}: {
  item: AdminConversationSummary | null;
  onClose: () => void;
  onMessage: (user: AdminUser) => void;
}) {
  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>Conversation</SheetTitle>
              <SheetDescription>
                Started {formatRelative(item.conversation.firstMessageAt ?? item.conversation.createdAt)} ·{" "}
                {formatNumber(item.conversation.messageCount)} messages
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-4">
              {item.isReported && (
                <section className="rounded-xl bg-error-soft p-3 text-[13px] text-error">
                  <p className="font-medium">
                    Reported{item.reportReason ? `: ${pretty(item.reportReason)}` : ""}
                    {item.reportCount > 1 ? ` (${item.reportCount} reports)` : ""}
                  </p>
                  {item.reportDetails && <p className="mt-1">{item.reportDetails}</p>}
                  <p className="mt-1 text-error/80">
                    {item.reporter ? `By ${displayName(item.reporter)}` : ""}
                    {item.reportedUser ? ` about ${displayName(item.reportedUser)}` : ""}
                    {item.reportedAt ? ` · ${formatRelative(item.reportedAt)}` : ""}
                  </p>
                </section>
              )}

              {item.content && (
                <section className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-xs text-muted">About</p>
                  <PostCell post={item.content} />
                </section>
              )}

              <Party role="Buyer" user={item.buyer} unread={item.conversation.buyerUnreadCount} onMessage={onMessage} />
              <Party role="Seller" user={item.seller} unread={item.conversation.sellerUnreadCount} onMessage={onMessage} />

              <section className="rounded-xl border border-border p-3">
                <p className="mb-1 text-xs text-muted">
                  Last message
                  {item.conversation.lastMessageAt && ` · ${formatDate(item.conversation.lastMessageAt)}`}
                </p>
                <p className="text-sm text-foreground">
                  {senderOf(item) && <span className="text-muted">{senderOf(item)}: </span>}
                  {item.conversation.lastMessageText || pretty(item.conversation.lastMessageType) || "—"}
                </p>
              </section>

              {item.dealClosed && item.conversation.dealClosedAt && (
                <p className="text-[13px] text-success">Deal closed {formatRelative(item.conversation.dealClosedAt)}</p>
              )}
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
