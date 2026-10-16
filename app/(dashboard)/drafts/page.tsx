"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApolloClient, useQuery } from "@apollo/client/react";
import { FilePen, RefreshCw } from "lucide-react";
import { ADMIN_DRAFTS, ADMIN_DRAFT_COUNTS } from "@/graphql/operations";
import type { AdminDraft } from "@/graphql/types";
import { displayName, formatDate, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { DraftCell } from "@/components/drafts/draft-media";
import { DraftStatusLine } from "@/components/drafts/draft-status";
import { DraftRowActions, DRAFT_REFETCH } from "@/components/drafts/draft-actions";
import { DraftSheet } from "@/components/drafts/draft-detail";
import { DRAFT_TABS, draftTab, type DraftTabKey } from "@/components/drafts/draft-tabs";

const PAGE_SIZE = 20;

const EMPTY_COPY: Record<DraftTabKey, { title: string; description?: string }> = {
  attention: { title: "No stuck drafts", description: "Every seller's draft has working media and no refused publish." },
  active: { title: "No drafts in progress" },
  scheduled: { title: "Nothing scheduled" },
  published: { title: "No published drafts" },
  discarded: { title: "No discarded drafts" },
};

export default function DraftsPage() {
  return (
    <Suspense>
      <DraftsScreen />
    </Suspense>
  );
}

function DraftsScreen() {
  const params = useSearchParams();
  const client = useApolloClient();

  const tabKey: DraftTabKey = draftTab(params.get("tab"))?.key ?? "attention";
  const tab = draftTab(tabKey)!;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(params.get("q") ?? "");
  const search = useDebouncedValue(searchInput.trim());
  const [opened, setOpened] = useState<AdminDraft | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: countData } = useQuery(ADMIN_DRAFT_COUNTS, {
    variables: { search: search || null },
    fetchPolicy: "cache-and-network",
  });
  const counts = countData?.adminDraftCounts;

  const { data, loading } = useQuery(ADMIN_DRAFTS, {
    variables: { tab: tab.tab, page, limit: PAGE_SIZE, search: search || null },
    fetchPolicy: "cache-and-network",
  });
  const drafts = useMemo(() => data?.adminDrafts.data ?? [], [data]);
  const meta = data?.adminDrafts.meta;

  function tabHref(key: DraftTabKey) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", key);
    return `/drafts?${next.toString()}`;
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await client.refetchQueries({ include: DRAFT_REFETCH });
    } finally {
      setRefreshing(false);
    }
  }

  const empty = EMPTY_COPY[tabKey];

  return (
    <>
      <PageHeader
        title="Drafts"
        description="Listings sellers started but haven’t posted — see what’s stopping them, and publish for them."
        actions={
          <Button variant="outline" onClick={() => void refresh()} loading={refreshing}>
            {!refreshing && <RefreshCw />} Refresh
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <ListToolbar
          tabs={
            <CountTabs
              tabs={DRAFT_TABS.map((t) => ({
                key: t.key,
                label: t.label,
                count: counts?.[t.countKey],
                attention: t.attention,
                href: tabHref(t.key),
              }))}
              value={tabKey}
              onChange={() => setPage(1)}
            />
          }
        >
          <SearchInput
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              setPage(1);
            }}
            placeholder="Title, seller, email or phone"
          />
        </ListToolbar>

        {loading && !data ? (
          <TableSkeleton />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={FilePen}
            title={search ? "No drafts match your search" : empty.title}
            description={search ? undefined : empty.description}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Draft</TableHead>
                <TableHead className="hidden lg:table-cell">Seller</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Last saved</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((draft) => (
                <TableRow
                  key={draft.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setOpened(draft);
                    setSheetOpen(true);
                  }}
                >
                  <TableCell className="max-w-[12rem] sm:max-w-80">
                    <DraftCell draft={draft} />
                    {/* Phones drop the status column; keep the status with the draft. */}
                    <div className="mt-1.5 pl-[52px] sm:hidden">
                      <DraftStatusLine draft={draft} />
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-56 lg:table-cell">
                    <Person
                      size="sm"
                      name={displayName(draft.creator)}
                      avatar={draft.creator?.profile?.avatar}
                      secondary={draft.creator?.email ?? (draft.creator?.username ? `@${draft.creator.username}` : undefined)}
                    />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <DraftStatusLine draft={draft} />
                  </TableCell>
                  <TableCell
                    className="hidden whitespace-nowrap text-muted md:table-cell"
                    title={formatDate(draft.updatedAt)}
                  >
                    {formatRelative(draft.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <DraftRowActions draft={draft} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="border-t border-border px-4 pb-3">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <DraftSheet draft={opened} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
