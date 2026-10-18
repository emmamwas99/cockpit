"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApolloClient, useQuery } from "@apollo/client/react";
import { toast } from "sonner";
import { Check, Clapperboard, RefreshCw, X } from "lucide-react";
import {
  ADMIN_CONTENT,
  ADMIN_CONTENT_COUNTS,
  APPROVE_CONTENT,
  REJECT_CONTENT,
} from "@/graphql/operations";
import type { AdminContent } from "@/graphql/types";
import { displayName, formatDate, formatNumber, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  SearchInput,
  TableSkeleton,
  useDebouncedValue,
} from "@/components/shared/page";
import { PostCell } from "@/components/posts/post-thumb";
import { PostRowActions, POST_REFETCH } from "@/components/posts/post-actions";
import { PostSheet, PostStatusLine } from "@/components/posts/post-detail";
import { POST_TABS, postTab, type PostTabKey } from "@/components/posts/post-tabs";
import { MediaRecoveryButton } from "@/components/posts/media-recovery-button";
import { Select } from "@/components/ui/select";
import { AdminPostSort } from "@/graphql/types";

const PAGE_SIZE = 20;

export default function PostsPage() {
  return (
    <Suspense>
      <PostsScreen />
    </Suspense>
  );
}

function PostsScreen() {
  const params = useSearchParams();
  const client = useApolloClient();

  const tabKey: PostTabKey = postTab(params.get("tab"))?.key ?? "pending";
  const tab = postTab(tabKey)!;
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<AdminPostSort>(AdminPostSort.RECENT);
  const [searchInput, setSearchInput] = useState(params.get("q") ?? "");
  const search = useDebouncedValue(searchInput.trim());
  const [opened, setOpened] = useState<AdminContent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const { data: countData } = useQuery(ADMIN_CONTENT_COUNTS, {
    variables: { search: search || null },
    fetchPolicy: "cache-and-network",
  });
  const counts = countData?.adminContentCounts;

  const { data, loading } = useQuery(ADMIN_CONTENT, {
    variables: {
      page,
      limit: PAGE_SIZE,
      status: tab.status ?? null,
      reported: tab.reported ?? null,
      search: search || null,
      sort,
    },
    fetchPolicy: "cache-and-network",
  });
  const posts = useMemo(() => data?.adminContent.data ?? [], [data]);
  const meta = data?.adminContent.meta;

  // Bulk approve/reject is for the review queue, where posts arrive in batches.
  const bulk = tabKey === "pending";
  const selectedPosts = posts.filter((post) => selected.has(post.id));
  const allSelected = posts.length > 0 && posts.every((post) => selected.has(post.id));

  function prepareTabChange() {
    setPage(1);
    setSelected(new Set());
  }

  function tabHref(key: PostTabKey) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", key);
    return `/posts?${next.toString()}`;
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await client.refetchQueries({ include: POST_REFETCH });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Posts"
        description="Review new listings and manage every post on Shopi."
        actions={
          <>
            <MediaRecoveryButton />
            <Button variant="outline" onClick={() => void refresh()} loading={refreshing}>
              {!refreshing && <RefreshCw />} Refresh
            </Button>
          </>
        }
      />

      <Card className="overflow-x-clip">
        <ListToolbar
          tabs={
            <CountTabs
              tabs={POST_TABS.map((t) => ({
                key: t.key,
                label: t.label,
                count: counts?.[t.countKey],
                attention: t.attention,
                href: tabHref(t.key),
              }))}
              value={tabKey}
              onChange={prepareTabChange}
            />
          }
        >
          <SearchInput
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              setPage(1);
            }}
            placeholder="Title, listing no. or seller"
          />
          <Select
            aria-label="Sort posts"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as AdminPostSort);
              setPage(1);
              setSelected(new Set());
            }}
            className="w-full sm:w-56"
          >
            <option value={AdminPostSort.RECENT}>Newest first</option>
            <option value={AdminPostSort.VIEWS}>Most views</option>
            <option value={AdminPostSort.ENGAGEMENT}>Most engagement</option>
          </Select>
          {sort === AdminPostSort.ENGAGEMENT && (
            <span className="text-xs text-muted">
              Saves, messages, product and profile clicks, comments, shares and likes
            </span>
          )}
        </ListToolbar>

        {bulk && selectedPosts.length > 0 && (
          <BulkBar posts={selectedPosts} onDone={() => setSelected(new Set())} />
        )}

        {loading && !data ? (
          <TableSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={Clapperboard}
            title={
              search
                ? "No posts match your search"
                : tabKey === "pending"
                  ? "All caught up"
                  : "No posts here"
            }
            description={
              !search && tabKey === "pending" ? "Nothing is waiting for review right now." : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {bulk && (
                  <TableHead className="hidden w-10 pr-0 sm:table-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? new Set() : new Set(posts.map((post) => post.id)))
                      }
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </TableHead>
                )}
                <TableHead>Listing</TableHead>
                <TableHead className="hidden lg:table-cell">Seller</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden text-right md:table-cell">Views</TableHead>
                <TableHead className="hidden md:table-cell">Posted</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow
                  key={post.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setOpened(post);
                    setSheetOpen(true);
                  }}
                >
                  {bulk && (
                    <TableCell className="hidden w-10 pr-0 sm:table-cell" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${post.title}`}
                        checked={selected.has(post.id)}
                        onChange={() => toggle(post.id)}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </TableCell>
                  )}
                  <TableCell className="max-w-[12rem] sm:max-w-80">
                    <PostCell post={post} />
                    {/* Phones drop the status column; keep the status with the post. */}
                    <div className="mt-1.5 pl-[52px] sm:hidden">
                      <PostStatusLine post={post} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-56 lg:table-cell">
                    <Person
                      size="sm"
                      name={displayName(post.creator)}
                      avatar={post.creator?.profile?.avatar}
                      secondary={post.creator?.username ? `@${post.creator.username}` : undefined}
                    />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <PostStatusLine post={post} />
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted md:table-cell">
                    {formatNumber(post.stats.views)}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted md:table-cell" title={formatDate(post.createdAt)}>
                    {formatRelative(post.createdAt)}
                  </TableCell>
                  <TableCell>
                    <PostRowActions post={post} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="sticky bottom-0 z-20 border-t border-border bg-elevated/95 px-4 pb-1 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <PostSheet post={opened} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}

/** Approve or reject every selected post in the review queue at once. */
function BulkBar({ posts, onDone }: { posts: AdminContent[]; onDone: () => void }) {
  const client = useApolloClient();
  const [working, setWorking] = useState<"approve" | "reject" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function run(kind: "approve" | "reject") {
    setWorking(kind);
    const results = await Promise.allSettled(
      posts.map((post) =>
        kind === "approve"
          ? client.mutate({ mutation: APPROVE_CONTENT, variables: { contentId: post.id } })
          : client.mutate({
              mutation: REJECT_CONTENT,
              variables: { contentId: post.id, reason: reason.trim() },
            }),
      ),
    );
    await client.refetchQueries({ include: POST_REFETCH });
    setWorking(null);

    const failed = results.filter((result) => result.status === "rejected").length;
    const done = results.length - failed;
    const verb = kind === "approve" ? "Approved" : "Rejected";
    if (failed === 0) toast.success(`${verb} ${done} post${done === 1 ? "" : "s"}`);
    else toast.error(`${verb} ${done}, ${failed} failed — try those again`);
    setRejectOpen(false);
    setReason("");
    onDone();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary-soft/50 px-4 py-2">
      <p className="mr-auto text-sm font-medium text-foreground">{posts.length} selected</p>
      <Button size="sm" onClick={() => void run("approve")} loading={working === "approve"} disabled={!!working}>
        {working !== "approve" && <Check />} Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-error hover:bg-error-soft"
        onClick={() => setRejectOpen(true)}
        disabled={!!working}
      >
        <X /> Reject
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone} disabled={!!working}>
        Clear
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {posts.length} post{posts.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>Each seller is emailed this reason.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-reject-reason">Reason</Label>
            <Textarea
              id="bulk-reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Photos don't show the product clearly"
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void run("reject")}
              loading={working === "reject"}
              disabled={!reason.trim()}
            >
              Reject all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
