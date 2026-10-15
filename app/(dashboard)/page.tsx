"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Flag,
  Gift,
  Megaphone,
  MessageSquareWarning,
  MessagesSquare,
  Star,
} from "lucide-react";
import {
  ADMIN_APP_RATING_OVERVIEW,
  ADMIN_CONTENT,
  ADMIN_CONVERSATION_COUNTS,
  ADMIN_DASHBOARD_STATS,
  ADMIN_GROWTH_PULSE,
  ADMIN_REFERRAL_OVERVIEW,
} from "@/graphql/operations";
import { ContentStatus, type AdminContent } from "@/graphql/types";
import { displayName, formatKes, formatNumber, formatRelative } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";
import { useTeamUnreadThreads } from "@/components/team/team-inbox-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { AttentionRow, EmptyState, PageHeader, StatCard, percentChange } from "@/components/shared/page";
import { PostCell } from "@/components/posts/post-thumb";
import { PostRowActions } from "@/components/posts/post-actions";
import { PostSheet } from "@/components/posts/post-detail";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}


function Total({ label, value, hint }: { label: string; value?: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right">
        {value === undefined ? (
          <Skeleton className="h-5 w-16" />
        ) : (
          <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
        )}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </dd>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const teamUnread = useTeamUnreadThreads();
  const [opened, setOpened] = useState<AdminContent | null>(null);

  const { data: statsData } = useQuery(ADMIN_DASHBOARD_STATS, { fetchPolicy: "cache-and-network" });
  const stats = statsData?.adminDashboardStats;
  const { data: pulseData } = useQuery(ADMIN_GROWTH_PULSE, {
    variables: { days: 30, months: 3 },
    fetchPolicy: "cache-and-network",
  });
  const pulse = pulseData?.adminGrowthPulse;
  const { data: conversationData } = useQuery(ADMIN_CONVERSATION_COUNTS, { fetchPolicy: "cache-and-network" });
  const conversations = conversationData?.adminConversationCounts;
  const { data: referralData } = useQuery(ADMIN_REFERRAL_OVERVIEW, { fetchPolicy: "cache-and-network" });
  const referrals = referralData?.adminReferralOverview;
  const { data: ratingData } = useQuery(ADMIN_APP_RATING_OVERVIEW, {
    variables: { days: 30 },
    fetchPolicy: "cache-and-network",
  });
  const ratings = ratingData?.adminAppRatingOverview;
  const { data: pendingData, loading: pendingLoading } = useQuery(ADMIN_CONTENT, {
    variables: { page: 1, limit: 5, status: ContentStatus.PENDING_REVIEW },
    fetchPolicy: "cache-and-network",
  });
  const pending = pendingData?.adminContent.data ?? [];

  const comparison = (key: string) => pulse?.comparisons.find((c) => c.key === key);
  const firstName = user?.profile?.firstName || displayName(user);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <div className="divide-y divide-border border-t border-border">
            <AttentionRow
              icon={Clock3}
              label="Posts waiting for review"
              description="Approve or reject new listings"
              count={stats?.pendingReviewContent}
              href="/posts?tab=pending"
            />
            <AttentionRow
              icon={Flag}
              label="Reported posts"
              description="Flagged by buyers"
              count={stats?.reportedContent}
              href="/posts?tab=reported"
            />
            <AttentionRow
              icon={AlertTriangle}
              label="Failed uploads"
              description="Media that didn't process"
              count={stats?.failedContent}
              href="/posts?tab=failed"
            />
            <AttentionRow
              icon={MessagesSquare}
              label="Sellers owing a reply"
              description="Buyers waiting to hear back"
              count={conversations?.sellerNeedsReply}
              href="/conversations?queue=SELLER_NEEDS_REPLY"
            />
            <AttentionRow
              icon={MessageSquareWarning}
              label="Reported conversations"
              count={conversations?.reported}
              href="/conversations?queue=REPORTED"
            />
            <AttentionRow
              icon={Gift}
              label="Referral rewards to pay"
              description={referrals && referrals.rewardsPending > 0 ? formatKes(referrals.rewardsPendingKes) : undefined}
              count={referrals?.rewardsPending}
              href="/referrals"
            />
            <AttentionRow
              icon={Star}
              label="Unhappy app ratings"
              description="Rated 1–2 stars"
              count={ratings?.unhappyCount}
              href="/ratings"
            />
            <AttentionRow icon={Megaphone} label="Unread Shopi team replies" count={teamUnread} href="/team" />
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle>Platform</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <dl className="divide-y divide-border">
              <Total
                label="Users"
                value={stats ? formatNumber(stats.totalUsers) : undefined}
                hint={stats ? `+${formatNumber(stats.newUsersToday)} today` : undefined}
              />
              <Total label="Live listings" value={stats ? formatNumber(stats.activeContent) : undefined} />
              <Total label="All posts" value={stats ? formatNumber(stats.totalContent) : undefined} />
              <Total
                label="Activated sellers"
                value={pulse ? `${pulse.activation.lifetimeActivationPercent}%` : undefined}
                hint="of users have posted"
              />
              <Total
                label="App rating"
                value={ratings ? (ratings.allTime.total ? `${ratings.allTime.average.toFixed(1)} ★` : "—") : undefined}
                hint={ratings ? `${formatNumber(ratings.allTime.total)} ratings` : undefined}
              />
              <Total label="Total views" value={stats ? formatNumber(stats.totalViews) : undefined} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">Last 30 days</h2>
          <Link href="/growth" className="text-[13px] font-medium text-primary hover:underline">
            Growth details
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["signups", "Signups"],
              ["posts", "Posts"],
              ["postingSellers", "Sellers who posted"],
              ["newSellers", "First-time sellers"],
            ] as const
          ).map(([key, label]) => {
            const c = comparison(key);
            return (
              <StatCard
                key={key}
                label={label}
                value={c ? formatNumber(c.current) : undefined}
                change={c ? percentChange(c.current, c.previous) : undefined}
                changeSuffix="vs previous 30 days"
              />
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Signups and posts per day</CardTitle>
          </CardHeader>
          <CardContent>
            {pulse ? (
              <TimeSeriesChart
                dates={pulse.daily.map((day) => day.key)}
                series={[
                  { name: "Signups", color: "var(--chart-1)", values: pulse.daily.map((day) => day.signups) },
                  { name: "Posts", color: "var(--chart-2)", values: pulse.daily.map((day) => day.posts) },
                ]}
                valueFormatter={formatNumber}
                height={220}
              />
            ) : (
              <Skeleton className="h-56 w-full" />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Waiting for review</CardTitle>
            <Link
              href="/posts?tab=pending"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
            >
              See all <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          {pendingLoading && !pendingData ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <EmptyState title="All caught up" description="No posts are waiting for review." />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {pending.map((post) => (
                <li
                  key={post.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface"
                  onClick={() => setOpened(post)}
                >
                  <PostCell post={post} className="flex-1" />
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
