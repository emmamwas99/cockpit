"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@apollo/client/react";
import { BadgeCheck, Clock3, MoreHorizontal, ExternalLink } from "lucide-react";
import { ADMIN_SHOP_VERIFICATIONS, ADMIN_SHOP_VERIFICATION_COUNTS } from "@/graphql/operations";
import {
  ShopVerificationStatus,
  type AdminShopVerification,
  type AdminShopVerificationCounts,
} from "@/graphql/types";
import { formatDate, formatRelative } from "@/lib/format";
import { webUrl } from "@/lib/web-url";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/shared/pagination";
import {
  CountTabs,
  EmptyState,
  ListToolbar,
  PageHeader,
  SearchInput,
  TableSkeleton,
  useDebouncedValue,
} from "@/components/shared/page";
import {
  DocumentThumb,
  VerificationStatusBadge,
  VerifiedTick,
  placeLine,
} from "@/components/verification/verification-ui";
import { VerificationSheet } from "@/components/verification/verification-sheet";

const PAGE_SIZE = 20;

type TabKey = "waiting" | "verified" | "changes" | "removed" | "started";

const TABS: {
  key: TabKey;
  label: string;
  countKey: keyof AdminShopVerificationCounts;
  status: ShopVerificationStatus;
  empty: { title: string; description: string };
}[] = [
  {
    key: "waiting",
    label: "Waiting",
    countKey: "pending",
    status: ShopVerificationStatus.PENDING,
    empty: { title: "No shops waiting", description: "New applications land here, oldest first." },
  },
  {
    key: "verified",
    label: "Verified",
    countKey: "approved",
    status: ShopVerificationStatus.APPROVED,
    empty: { title: "No verified shops yet", description: "Shops you verify show here." },
  },
  {
    key: "changes",
    label: "Needs changes",
    countKey: "rejected",
    status: ShopVerificationStatus.REJECTED,
    empty: { title: "Nothing sent back", description: "Applications you return to sellers wait here until they resubmit." },
  },
  {
    key: "removed",
    label: "Removed",
    countKey: "revoked",
    status: ShopVerificationStatus.REVOKED,
    empty: { title: "No removals", description: "Shops whose verification was taken away show here." },
  },
  {
    key: "started",
    label: "Started",
    countKey: "draft",
    status: ShopVerificationStatus.DRAFT,
    empty: { title: "No unfinished applications", description: "Sellers who began but haven't submitted show here." },
  },
];

export default function VerificationPage() {
  return (
    <Suspense>
      <VerificationScreen />
    </Suspense>
  );
}

function VerificationScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tabKey = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "waiting") as TabKey;
  const tab = TABS.find((t) => t.key === tabKey)!;

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const search = useDebouncedValue(searchInput.trim());
  const [openedUserId, setOpenedUserId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // The admin push for a new application links to ?user=<id>, which opens that
  // seller straight away; the URL stays the source of truth until it's closed.
  const linkedUser = params.get("user");
  const sheetUserId = linkedUser ?? openedUserId;
  const isSheetOpen = Boolean(linkedUser) || sheetOpen;

  const { data: countData } = useQuery(ADMIN_SHOP_VERIFICATION_COUNTS, {
    variables: { search: search || null },
    fetchPolicy: "cache-and-network",
  });
  const counts = countData?.adminShopVerificationCounts;

  const { data, loading } = useQuery(ADMIN_SHOP_VERIFICATIONS, {
    variables: { page, limit: PAGE_SIZE, status: tab.status, search: search || null },
    fetchPolicy: "cache-and-network",
  });
  const rows = data?.adminShopVerifications.data ?? [];
  const meta = data?.adminShopVerifications.meta;

  function switchTab(key: TabKey) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", key);
    next.delete("user");
    router.replace(`/verification?${next.toString()}`, { scroll: false });
    setPage(1);
  }

  function clearLinkedUser() {
    const next = new URLSearchParams(params.toString());
    next.delete("user");
    const query = next.toString();
    router.replace(query ? `/verification?${query}` : "/verification", { scroll: false });
  }

  function openRow(row: AdminShopVerification) {
    if (linkedUser) clearLinkedUser();
    setOpenedUserId(row.userId);
    setSheetOpen(true);
  }

  function closeSheet(open: boolean) {
    setSheetOpen(open);
    if (!open && linkedUser) clearLinkedUser();
  }

  const waitingTab = tab.status === ShopVerificationStatus.PENDING;

  return (
    <>
      <PageHeader
        title="Shop verification"
        description="Check each seller's business permit, shop photo and location. Verified shops get the blue tick and Verified ID on their listings."
      />

      <Card className="overflow-x-clip">
        <ListToolbar
          tabs={
            <CountTabs
              tabs={TABS.map((t) => ({
                key: t.key,
                label: t.label,
                count: counts?.[t.countKey],
                attention: t.key === "waiting",
              }))}
              value={tabKey}
              onChange={switchTab}
            />
          }
        >
          <SearchInput
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              setPage(1);
            }}
            placeholder="Business, seller, email or area"
          />
          {waitingTab && (meta?.total ?? 0) > 0 && (
            <p className="ml-auto flex items-center gap-1.5 text-xs text-muted">
              <Clock3 className="size-3.5" /> Oldest first
            </p>
          )}
        </ListToolbar>

        {loading && !data ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title={search ? "No shops match your search" : tab.empty.title}
            description={search ? undefined : tab.empty.description}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead className="hidden md:table-cell">Documents</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead className="hidden sm:table-cell">{waitingTab ? "Waiting" : "Updated"}</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const application = row.application;
                const applicant = row.applicant;
                const sellerName = applicant?.displayName ?? "Deleted account";
                const businessName = application?.businessName || sellerName;
                const when = waitingTab ? application?.submittedAt : application?.updatedAt;
                return (
                  <TableRow key={row.userId} className="cursor-pointer" onClick={() => openRow(row)}>
                    <TableCell className="max-w-80">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar src={applicant?.avatar} name={sellerName} className="size-8" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                            <span className="truncate">{businessName}</span>
                            {applicant?.isVerified && <VerifiedTick className="size-3.5" />}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {[application?.businessName ? sellerName : null, applicant?.username ? `@${applicant.username}` : null]
                              .filter(Boolean)
                              .join(" · ") || applicant?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <DocumentThumb document={application?.permit} label="Business permit" />
                        <DocumentThumb document={application?.shopPhoto} label="Shop photo" />
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-56 truncate text-muted lg:table-cell">
                      {placeLine(application?.location) || "—"}
                    </TableCell>
                    <TableCell
                      className="hidden whitespace-nowrap text-muted sm:table-cell"
                      title={formatDate(when)}
                    >
                      {waitingTab && when ? formatRelative(when).replace(/ ago$/, "") : formatRelative(when)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {application && <VerificationStatusBadge status={application.status} />}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Actions for ${businessName}`}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenuItem onSelect={() => openRow(row)}>
                            <BadgeCheck /> {waitingTab ? "Review" : "Open"}
                          </DropdownMenuItem>
                          {applicant?.username && (
                            <DropdownMenuItem asChild>
                              <a href={webUrl(`/en/@${applicant.username}`)} target="_blank" rel="noopener noreferrer">
                                <ExternalLink /> Open storefront
                              </a>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      <VerificationSheet userId={sheetUserId} open={isSheetOpen} onOpenChange={closeSheet} />
    </>
  );
}
