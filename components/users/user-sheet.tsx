"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import { ArrowLeft, BadgeCheck, Megaphone } from "lucide-react";
import { ADMIN_CONTENT_COUNTS } from "@/graphql/operations";
import { UserRole, type AdminContent, type AdminUser } from "@/graphql/types";
import { displayName, formatDate, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CountTabs } from "@/components/shared/page";
import { SellerPosts } from "@/components/posts/seller-posts";
import { PostDetail } from "@/components/posts/post-detail";
import { referrerLabel } from "@/components/posts/post-badges";
import { UserActionMenu, isSeller, rolesOf, type UserActionsApi } from "./user-actions";

export type UserSheetTab = "profile" | "posts";

export function locationText(user: AdminUser): string {
  const loc = user.adminLocation;
  if (!loc) return "";
  const place = [loc.ward, loc.county ?? loc.city].filter(Boolean).join(", ");
  return loc.approximate && place ? `${place} (approx.)` : place;
}

function deviceText(user: AdminUser): string {
  const device = user.signupDevice;
  if (!device) return "";
  const kind = device.deviceType.charAt(0) + device.deviceType.slice(1).toLowerCase();
  return [kind, device.operatingSystem, device.browser].filter(Boolean).join(" · ");
}

function providersText(user: AdminUser): string {
  const providers = user.authProviders;
  if (!providers) return "";
  return [
    providers.local && "Email",
    providers.google && "Google",
    providers.facebook && "Facebook",
    providers.apple && "Apple",
    providers.tiktok && "TikTok",
  ]
    .filter(Boolean)
    .join(", ");
}

function Fact({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{value || "—"}</dd>
    </div>
  );
}

function Profile({ user, onViewPosts }: { user: AdminUser; onViewPosts: () => void }) {
  const seller = isSeller(user);
  const { data } = useQuery(ADMIN_CONTENT_COUNTS, {
    variables: { creatorId: user.id },
    skip: !seller,
    fetchPolicy: "cache-and-network",
  });
  const counts = data?.adminContentCounts;
  const attribution = user.attribution;

  return (
    <div className="space-y-5">
      {user.isSuspended && (
        <p className="rounded-lg bg-error-soft px-3 py-2 text-[13px] text-error">
          Suspended {user.suspendedAt ? formatRelative(user.suspendedAt) : ""}
          {user.suspensionReason ? ` — ${user.suspensionReason}` : ""}
        </p>
      )}

      {seller && (
        <section className="rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Selling on Shopi</p>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={onViewPosts}>
              View posts
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center">
            {[
              ["Posts", counts?.all],
              ["Live", counts?.active],
              ["In review", counts?.pendingReview],
              ["Rejected", counts?.rejected],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg bg-surface py-2">
                <p className="text-base font-semibold tabular-nums text-foreground">
                  {value === undefined ? "—" : formatNumber(value as number)}
                </p>
                <p className="text-[11px] text-muted">{label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {user.profile?.bio && <p className="text-sm text-foreground">{user.profile.bio}</p>}

      <dl className="divide-y divide-border rounded-xl border border-border px-3">
        <Fact label="Joined" value={formatDate(user.createdAt)} />
        <Fact label="Location" value={locationText(user)} />
        <Fact label="Signed up on" value={deviceText(user)} />
        <Fact
          label="Came from"
          value={
            attribution?.source
              ? [attribution.source, attribution.medium?.toLowerCase(), attribution.campaign]
                  .filter(Boolean)
                  .join(" · ")
              : "Unknown"
          }
        />
        <Fact
          label="Referred"
          value={
            user.referredBy ? `${referrerLabel(user.referredBy)} · ${user.referredBy.code}` : "No"
          }
        />
        <Fact label="Signs in with" value={providersText(user)} />
        <Fact label="Profile visits" value={formatNumber(user.profileVisitCount)} />
      </dl>
    </div>
  );
}

/** One user in full: profile, their posts if they sell, and every account action. */
export function UserSheet({
  user,
  open,
  onOpenChange,
  tab,
  onTabChange,
  api,
}: {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: UserSheetTab;
  onTabChange: (tab: UserSheetTab) => void;
  api: UserActionsApi;
}) {
  const [post, setPost] = useState<AdminContent | null>(null);
  const { data } = useQuery(ADMIN_CONTENT_COUNTS, {
    variables: { creatorId: user?.id ?? "" },
    skip: !user || !isSeller(user),
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setPost(null);
      }}
    >
      <SheetContent className="sm:max-w-2xl">
        {user && (
          <>
            <SheetHeader className="space-y-3 pb-0">
              <div className="flex items-start gap-3">
                <Avatar src={user.profile?.avatar} name={displayName(user)} className="size-12" />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="flex items-center gap-1.5">
                    <span className="truncate">{displayName(user)}</span>
                    {user.isVerified && (
                      <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />
                    )}
                  </SheetTitle>
                  <SheetDescription className="truncate">
                    {[user.username && `@${user.username}`, user.email].filter(Boolean).join(" · ")}
                  </SheetDescription>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {isSeller(user) && <Badge variant="accent">Seller</Badge>}
                    {rolesOf(user).includes(UserRole.ADMIN) && <Badge>Admin</Badge>}
                    {user.isSuspended && <Badge variant="destructive">Suspended</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 pr-8">
                  <Button size="sm" variant="outline" onClick={() => api.open("message", user)}>
                    <Megaphone /> Message
                  </Button>
                  <UserActionMenu user={user} api={api} onViewPosts={() => onTabChange("posts")} />
                </div>
              </div>
              {isSeller(user) && (
                <CountTabs
                  tabs={[
                    { key: "profile" as const, label: "Profile" },
                    { key: "posts" as const, label: "Posts", count: data?.adminContentCounts.all },
                  ]}
                  value={tab}
                  onChange={(next) => {
                    setPost(null);
                    onTabChange(next);
                  }}
                  className="-mx-3"
                />
              )}
            </SheetHeader>
            <SheetBody className={cn(!isSeller(user) && "pt-4")}>
              {tab === "posts" && isSeller(user) ? (
                post ? (
                  <div className="space-y-4">
                    <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setPost(null)}>
                      <ArrowLeft /> All posts
                    </Button>
                    <p className="text-base font-semibold text-foreground">{post.title}</p>
                    <PostDetail post={post} />
                  </div>
                ) : (
                  <SellerPosts creatorId={user.id} onOpenPost={setPost} />
                )
              ) : (
                <Profile user={user} onViewPosts={() => onTabChange("posts")} />
              )}
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
