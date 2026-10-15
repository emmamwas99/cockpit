"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@apollo/client/react";
import { BadgeCheck, Plus, Users } from "lucide-react";
import { ADMIN_USERS, ADMIN_USER_COUNTS } from "@/graphql/operations";
import { UserRole, type AdminUser, type AdminUserCounts } from "@/graphql/types";
import { displayName, formatDate, formatRelative } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { CreateStaffDialog } from "@/components/users/user-dialogs";
import { UserActionMenu, isSeller, rolesOf, useUserActions } from "@/components/users/user-actions";
import { UserSheet, locationText, type UserSheetTab } from "@/components/users/user-sheet";

const PAGE_SIZE = 20;

type TabKey = "all" | "sellers" | "verified" | "admins" | "suspended";

const TABS: {
  key: TabKey;
  label: string;
  countKey: keyof AdminUserCounts;
  vars: { role?: UserRole; verified?: boolean; suspended?: boolean };
}[] = [
  { key: "all", label: "All", countKey: "all", vars: {} },
  { key: "sellers", label: "Sellers", countKey: "sellers", vars: { role: UserRole.CREATOR } },
  { key: "verified", label: "Verified", countKey: "verified", vars: { verified: true } },
  { key: "admins", label: "Admins", countKey: "admins", vars: { role: UserRole.ADMIN } },
  { key: "suspended", label: "Suspended", countKey: "suspended", vars: { suspended: true } },
];

export default function UsersPage() {
  return (
    <Suspense>
      <UsersScreen />
    </Suspense>
  );
}

function UsersScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tabKey = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "all") as TabKey;
  const tab = TABS.find((t) => t.key === tabKey)!;

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const search = useDebouncedValue(searchInput.trim());
  const [opened, setOpened] = useState<AdminUser | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<UserSheetTab>("profile");
  const [createOpen, setCreateOpen] = useState(false);
  const api = useUserActions();

  const { data: countData } = useQuery(ADMIN_USER_COUNTS, {
    variables: { search: search || null },
    fetchPolicy: "cache-and-network",
  });
  const counts = countData?.adminUserCounts;

  const { data, loading } = useQuery(ADMIN_USERS, {
    variables: {
      page,
      limit: PAGE_SIZE,
      search: search || null,
      role: tab.vars.role ?? null,
      verified: tab.vars.verified ?? null,
      suspended: tab.vars.suspended ?? null,
    },
    fetchPolicy: "cache-and-network",
  });
  const users = data?.adminUsers.data ?? [];
  const meta = data?.adminUsers.meta;
  // Keep the open panel on the freshest copy after an action refetches the list.
  const openedFresh = opened ? (users.find((u) => u.id === opened.id) ?? opened) : null;

  function switchTab(key: TabKey) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", key);
    router.replace(`/users?${next.toString()}`, { scroll: false });
    setPage(1);
  }

  function openUser(user: AdminUser, sheet: UserSheetTab = "profile") {
    setOpened(user);
    setSheetTab(sheet);
    setSheetOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone on Shopi — buyers, sellers and staff."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> Add staff
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <ListToolbar
          tabs={
            <CountTabs
              tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts?.[t.countKey] }))}
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
            placeholder="Name, email or @handle"
          />
        </ListToolbar>

        {loading && !data ? (
          <TableSkeleton />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title={search ? "No one matches your search" : "No users here"} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden sm:table-cell">Role</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const roles = rolesOf(user);
                const location = locationText(user);
                return (
                  <TableRow key={user.id} className="cursor-pointer" onClick={() => openUser(user)}>
                    <TableCell className="max-w-80">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar src={user.profile?.avatar} name={displayName(user)} className="size-8" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
                            <span className="truncate">{displayName(user)}</span>
                            {user.isVerified && (
                              <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified" />
                            )}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {user.email ?? (user.username ? `@${user.username}` : user.id)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {roles.includes(UserRole.ADMIN) && <Badge>Admin</Badge>}
                        {isSeller(user) ? (
                          <Badge variant="accent">Seller</Badge>
                        ) : (
                          !roles.includes(UserRole.ADMIN) && <span className="text-muted">Buyer</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-48 truncate text-muted lg:table-cell">{location || "—"}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted md:table-cell" title={formatDate(user.createdAt)}>
                      {formatRelative(user.createdAt)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {user.isSuspended ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActionMenu
                        user={user}
                        api={api}
                        onViewPosts={(target) => openUser(target, "posts")}
                      />
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

      <UserSheet
        user={openedFresh}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        tab={sheetTab}
        onTabChange={setSheetTab}
        api={api}
      />
      <CreateStaffDialog open={createOpen} onOpenChange={setCreateOpen} />
      {api.dialogs}
    </>
  );
}
