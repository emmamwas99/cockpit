"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { ADMIN_CONTENT, ADMIN_CONTENT_COUNTS } from "@/graphql/operations";
import type { AdminContent, AdminUser } from "@/graphql/types";
import { displayName, formatNumber, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pagination } from "@/components/shared/pagination";
import { CountTabs, EmptyState, Person, TableSkeleton } from "@/components/shared/page";
import { PostCell } from "./post-thumb";
import { PostRowActions } from "./post-actions";
import { PostDetail } from "./post-detail";
import { POST_TABS, type PostTabKey } from "./post-tabs";

const PAGE_SIZE = 10;

/**
 * One seller's posts, by status, with every post action — so a screen about a
 * seller (a referral, a user) can moderate their listings without sending the
 * admin off to the Posts tab.
 */
export function SellerPosts({
  creatorId,
  onOpenPost,
}: {
  creatorId: string;
  onOpenPost: (post: AdminContent) => void;
}) {
  const [tabKey, setTabKey] = useState<PostTabKey>("all");
  const [page, setPage] = useState(1);
  const tab = POST_TABS.find((t) => t.key === tabKey) ?? POST_TABS[1];

  const { data: countData } = useQuery(ADMIN_CONTENT_COUNTS, {
    variables: { creatorId },
    fetchPolicy: "cache-and-network",
  });
  const counts = countData?.adminContentCounts;

  const { data, loading } = useQuery(ADMIN_CONTENT, {
    variables: {
      creatorId,
      page,
      limit: PAGE_SIZE,
      status: tab.status ?? null,
      reported: tab.reported ?? null,
    },
    fetchPolicy: "cache-and-network",
  });
  const posts = data?.adminContent.data ?? [];
  const meta = data?.adminContent.meta;

  // "All" first; other tabs only once they have something, so a seller with
  // three live posts sees two tabs, not nine.
  const tabs = [POST_TABS[1], ...POST_TABS.filter((t) => t.key !== "all")]
    .filter((t) => t.key === "all" || t.key === tabKey || (counts?.[t.countKey] ?? 0) > 0)
    .map((t) => ({ key: t.key, label: t.label, count: counts?.[t.countKey], attention: t.attention }));

  return (
    <div className="space-y-3">
      <div className="border-b border-border">
        <CountTabs
          tabs={tabs}
          value={tabKey}
          onChange={(key) => {
            setTabKey(key);
            setPage(1);
          }}
        />
      </div>

      {loading && !data ? (
        <TableSkeleton rows={5} />
      ) : posts.length === 0 ? (
        <EmptyState icon={Clapperboard} title="No posts here" />
      ) : (
        <ul className="divide-y divide-border">
          {posts.map((post) => (
            <li key={post.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpenPost(post)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onOpenPost(post);
                }}
                className="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface"
              >
                <PostCell post={post} className="flex-1" />
                <div className="hidden shrink-0 text-right text-xs text-muted sm:block">
                  <p>{formatNumber(post.stats.views)} views</p>
                  <p>{formatRelative(post.createdAt)}</p>
                </div>
                <StatusBadge status={post.status} />
                <PostRowActions post={post} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="sticky bottom-0 z-20 border-t border-border bg-elevated/95 px-4 pb-1 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

/**
 * A seller's posts in a side panel: the list, and any one post opened in place
 * with a way back.
 */
export function SellerPostsSheet({
  seller,
  open,
  onOpenChange,
  context,
}: {
  seller: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A line under the seller's name saying why they are being looked at. */
  context?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<AdminContent | null>(null);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSelected(null);
      }}
    >
      <SheetContent className="sm:max-w-2xl">
        {seller && (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">Posts by {displayName(seller)}</SheetTitle>
              <SheetDescription className="sr-only">Their listings, with actions</SheetDescription>
              <Person
                name={displayName(seller)}
                avatar={seller.profile?.avatar}
                secondary={context ?? (seller.username ? `@${seller.username}` : seller.email)}
              />
            </SheetHeader>
            <SheetBody>
              {selected ? (
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setSelected(null)}>
                    <ArrowLeft /> All posts
                  </Button>
                  <div>
                    <p className="text-base font-semibold text-foreground">{selected.title}</p>
                  </div>
                  <PostDetail post={selected} />
                </div>
              ) : (
                <SellerPosts creatorId={seller.id} onOpenPost={setSelected} />
              )}
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
