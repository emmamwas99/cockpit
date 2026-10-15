"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { ADMIN_SYSTEM_OVERVIEW } from "@/graphql/operations";
import type { AdminContent } from "@/graphql/types";
import { formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Segmented, StatCard } from "@/components/shared/page";
import { PostCell } from "@/components/posts/post-thumb";
import { PostRowActions } from "@/components/posts/post-actions";
import { PostSheet } from "@/components/posts/post-detail";

type HealthResponse = {
  status: string;
  uptime: string;
  memory: string;
  services: Record<string, string>;
  worker?: { apiWorkersEnabled: boolean; serviceOnline: boolean; lastHeartbeatAt?: string | null };
  timestamp: string;
};

function ServiceRow({ label, detail, healthy }: { label: string; detail?: string | null; healthy: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className={cn("size-2 shrink-0 rounded-full", healthy ? "bg-success" : "bg-error")} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{label}</p>
        {detail && <p className="truncate text-xs text-muted">{detail}</p>}
      </div>
      <span className={cn("text-xs font-medium", healthy ? "text-success" : "text-error")}>
        {healthy ? "OK" : "Check"}
      </span>
    </div>
  );
}

export default function SystemPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stuckView, setStuckView] = useState<"failed" | "processing">("failed");
  const [opened, setOpened] = useState<AdminContent | null>(null);
  const { data, loading, refetch } = useQuery(ADMIN_SYSTEM_OVERVIEW, { fetchPolicy: "cache-and-network" });
  const overview = data?.adminSystemOverview;

  async function fetchHealth() {
    setHealthError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Health check returned ${res.status}`);
      setHealth((await res.json()) as HealthResponse);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "Health check failed");
    }
  }

  useEffect(() => {
    // The REST health check isn't in Apollo; load it once on arrival.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchHealth();
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), fetchHealth()]);
    } finally {
      setRefreshing(false);
    }
  }

  const problems = overview
    ? [
        // Workers, Redis, email and SMS are reported once, by the integrations.
        health && health.status !== "ok" && "API health is degraded",
        healthError && "Health check unreachable",
        health && health.services.mongodb !== "ok" && "Database is unreachable",
        overview.failedContent > 0 && `${overview.failedContent} failed posts`,
        overview.failedSchedules > 0 && `${overview.failedSchedules} failed scheduled posts`,
        overview.lockedAdminAccounts > 0 && `${overview.lockedAdminAccounts} locked admin accounts`,
        ...overview.integrations.filter((item) => !item.healthy).map((item) => `${item.label} needs attention`),
      ].filter((item): item is string => Boolean(item))
    : [];

  const stuck = stuckView === "failed" ? overview?.recentFailedContent : overview?.oldestProcessingContent;

  return (
    <>
      <PageHeader
        title="System"
        description="Services, queues and anything stuck."
        actions={
          <Button variant="outline" onClick={() => void refresh()} loading={refreshing}>
            {!refreshing && <RefreshCw />} Refresh
          </Button>
        }
      />

      {overview ? (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border px-4 py-3",
            problems.length === 0 ? "border-success/30 bg-success-soft" : "border-warning/40 bg-warning-soft",
          )}
        >
          {problems.length === 0 ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-secondary-strong" />
          )}
          <div>
            <p className="text-sm font-medium text-foreground">
              {problems.length === 0
                ? "Everything is running normally"
                : `${problems.length} thing${problems.length === 1 ? "" : "s"} need${problems.length === 1 ? "s" : ""} attention`}
            </p>
            {problems.length > 0 && <p className="mt-0.5 text-[13px] text-muted">{problems.join(" · ")}</p>}
          </div>
        </div>
      ) : (
        <Skeleton className="h-14 w-full" />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Waiting for review"
          value={overview ? formatNumber(overview.pendingReviewContent) : undefined}
          href="/posts?tab=pending"
        />
        <StatCard
          label="Processing media"
          value={overview ? formatNumber(overview.processingContent) : undefined}
          href="/posts?tab=processing"
        />
        <StatCard
          label="Failed posts"
          value={overview ? formatNumber(overview.failedContent) : undefined}
          href="/posts?tab=failed"
        />
        <StatCard
          label="Scheduled to publish"
          value={overview ? formatNumber(overview.scheduledPublishes) : undefined}
          hint={overview && overview.failedSchedules > 0 ? `${overview.failedSchedules} failed` : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Services</CardTitle>
          </CardHeader>
          {loading && !overview ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border border-t border-border">
              <ServiceRow
                label="API"
                healthy={!healthError && health?.status === "ok"}
                detail={health ? `Up ${health.uptime} · ${health.memory} memory` : healthError}
              />
              {health && (
                <ServiceRow label="Database" healthy={health.services.mongodb === "ok"} detail={health.services.mongodb} />
              )}
              {overview?.integrations.map((item) => (
                <ServiceRow key={item.key} label={item.label} healthy={item.healthy} detail={item.detail} />
              ))}
              {overview && (
                <ServiceRow
                  label="Admin sign-in"
                  healthy={overview.lockedAdminAccounts === 0}
                  detail={`${overview.lockedAdminAccounts} of ${overview.totalAdmins} admin accounts locked`}
                />
              )}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle>Stuck posts</CardTitle>
            <Segmented
              options={[
                { key: "failed" as const, label: "Failed", count: overview?.recentFailedContent.length },
                { key: "processing" as const, label: "Oldest processing", count: overview?.oldestProcessingContent.length },
              ]}
              value={stuckView}
              onChange={setStuckView}
            />
          </CardHeader>
          {!stuck ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : stuck.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={stuckView === "failed" ? "No failed posts" : "Nothing stuck in processing"}
            />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {stuck.map((post) => (
                <li
                  key={post.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface"
                  onClick={() => setOpened(post)}
                >
                  <div className="min-w-0 flex-1">
                    <PostCell post={post} />
                    {post.processingError && (
                      <p className="mt-1 truncate pl-[52px] text-xs text-error">{post.processingError}</p>
                    )}
                  </div>
                  <span className="hidden shrink-0 text-xs text-muted sm:block">{formatRelative(post.createdAt)}</span>
                  <PostRowActions post={post} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <PostSheet post={opened} open={!!opened} onOpenChange={(open) => !open && setOpened(null)} />
    </>
  );
}
