"use client";

import Link from "next/link";
import { useQuery } from "@apollo/client/react";
import { AlertTriangle, ExternalLink, Mail, Megaphone, UserRound } from "lucide-react";
import { ADMIN_CONTENT } from "@/graphql/operations";
import type { AdminAppRatingRow, AdminRaterShop, AdminUser } from "@/graphql/types";
import { displayName, formatDate, formatNumber, formatRelative } from "@/lib/format";
import { webUrl } from "@/lib/web-url";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { PostThumb } from "@/components/posts/post-thumb";
import { ViewPostLink } from "@/components/posts/view-post-link";
import { SEGMENT_META, Stars } from "./rating-ui";

/**
 * Plain-language reasons a seller might be unhappy, read off their shop. Not a
 * diagnosis — a prompt for what to ask when following up.
 */
export function sellerSignals(shop: AdminRaterShop): string[] {
  const signals: string[] = [];
  if (shop.listingCount === 0) {
    signals.push("No listings left — everything they posted is gone.");
  } else if (shop.liveListingCount === 0 && shop.inReviewListingCount > 0) {
    signals.push(`Nothing live: ${shop.inReviewListingCount} listing${shop.inReviewListingCount === 1 ? " is" : "s are"} still in review or processing.`);
  }
  if (shop.blockedListingCount > 0) {
    signals.push(`${shop.blockedListingCount} listing${shop.blockedListingCount === 1 ? " was" : "s were"} rejected, removed or failed.`);
  }
  if (shop.liveListingCount > 0 && shop.inquiriesReceived === 0) {
    signals.push("Has live listings but no buyer has messaged them yet.");
  }
  if (shop.inquiriesReceived > 0 && shop.dealsClosed === 0) {
    signals.push(`${shop.inquiriesReceived} inquir${shop.inquiriesReceived === 1 ? "y" : "ies"}, no deal marked closed.`);
  }
  return signals;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="truncate text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function ShopStat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2" title={hint}>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{formatNumber(value)}</p>
    </div>
  );
}

function locationLabel(rater: AdminUser): string {
  const loc = rater.adminLocation;
  if (!loc) return "";
  const place = [loc.ward, loc.county ?? loc.city].filter(Boolean).join(", ");
  return loc.approximate && place ? `${place} (approx.)` : place;
}

function deviceLabel(rater: AdminUser): string {
  const device = rater.signupDevice;
  if (!device) return "";
  const kind = device.deviceType.charAt(0) + device.deviceType.slice(1).toLowerCase();
  return [kind, device.operatingSystem, device.browser].filter(Boolean).join(" · ");
}

function RecentListings({ creatorId }: { creatorId: string }) {
  const { data, loading } = useQuery(ADMIN_CONTENT, {
    variables: { creatorId, page: 1, limit: 6 },
    fetchPolicy: "cache-and-network",
  });
  const posts = data?.adminContent.data ?? [];

  if (loading && !data) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (posts.length === 0) return <p className="text-sm text-muted">No listings to show.</p>;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {posts.map((post) => (
        <div key={post.id} className="flex items-center gap-3 rounded-xl border border-border p-2">
          <PostThumb post={post} className="h-12 w-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {post.title || post.caption || "Untitled listing"}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
              <StatusBadge status={post.status} />
              <span>{formatNumber(post.stats.views)} views</span>
            </div>
          </div>
          <ViewPostLink post={post} />
        </div>
      ))}
    </div>
  );
}

export function RatingDetailDialog({
  row,
  open,
  onOpenChange,
  onMessage,
}: {
  row: AdminAppRatingRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessage: (rater: AdminUser) => void;
}) {
  if (!row) return null;
  const { rating, rater, shop, segment } = row;
  const name = rater ? displayName(rater) : "Deleted account";
  const meta = segment ? SEGMENT_META[segment] : null;
  const signals = shop ? sellerSignals(shop) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Stars value={rating.stars} className="[&_svg]:size-5" />
            <span>
              {rating.stars}★ from {name}
            </span>
          </DialogTitle>
          <DialogDescription>
            Rated {formatDate(rating.createdAt)}
            {row.revisedAt && ` · changed ${formatRelative(row.revisedAt)}`}
          </DialogDescription>
        </DialogHeader>

        <blockquote className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
          {rating.comment ? (
            <p className="whitespace-pre-wrap">{rating.comment}</p>
          ) : (
            <p className="text-muted">No comment — stars only.</p>
          )}
        </blockquote>

        {rater ? (
          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <Avatar src={rater.profile?.avatar} name={name} className="size-12" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-semibold text-foreground">{name}</p>
                  {meta && <Badge variant={meta.badge}>{meta.label}</Badge>}
                  {rater.isVerified && <Badge variant="success">Verified</Badge>}
                  {rater.isSuspended && <Badge variant="destructive">Suspended</Badge>}
                  {rater.socialProof?.featured && <Badge variant="outline">Featured</Badge>}
                </div>
                <p className="truncate text-sm text-muted">
                  {[rater.username && `@${rater.username}`, rater.email].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3 sm:grid-cols-3">
              <Fact label="Joined" value={formatDate(rater.createdAt)} />
              <Fact
                label="Rated after"
                value={
                  row.daysOnShopiAtRating == null
                    ? ""
                    : row.daysOnShopiAtRating === 0
                      ? "Less than a day"
                      : `${row.daysOnShopiAtRating} day${row.daysOnShopiAtRating === 1 ? "" : "s"}`
                }
              />
              <Fact label="Location" value={locationLabel(rater)} />
              <Fact label="Signed up on" value={deviceLabel(rater)} />
              <Fact label="Came from" value={rater.attribution?.source ?? "Unknown"} />
              <Fact
                label="As a buyer"
                value={`${formatNumber(row.conversationsStarted)} conversation${row.conversationsStarted === 1 ? "" : "s"}`}
              />
            </div>
          </section>
        ) : (
          <p className="text-sm text-muted">
            This account has since been deleted. The rating still counts in the totals.
          </p>
        )}

        {rater && shop && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Their shop</h3>
              {rater.username && (
                <Button asChild variant="outline" size="sm">
                  <a href={webUrl(`/en/@${rater.username}`)} target="_blank" rel="noopener noreferrer">
                    Open storefront <ExternalLink />
                  </a>
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ShopStat label="Live" value={shop.liveListingCount} hint={`${shop.listingCount} listings in total`} />
              <ShopStat label="In review" value={shop.inReviewListingCount} />
              <ShopStat label="Blocked" value={shop.blockedListingCount} hint="Rejected, removed or failed" />
              <ShopStat label="Followers" value={shop.followerCount} />
              <ShopStat label="Views" value={shop.totalViews} />
              <ShopStat label="Saves" value={shop.totalSaves} />
              <ShopStat label="Inquiries" value={shop.inquiriesReceived} hint="Conversations buyers opened" />
              <ShopStat label="Deals closed" value={shop.dealsClosed} />
            </div>
            <p className="text-xs text-muted">
              {shop.lastPostedAt ? `Last listed ${formatRelative(shop.lastPostedAt)}` : "Has not listed anything"}
            </p>

            {signals.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-warning-soft px-3 py-2">
                {signals.map((signal) => (
                  <li key={signal} className="flex items-start gap-2 text-xs font-medium text-secondary-strong">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {signal}
                  </li>
                ))}
              </ul>
            )}

            <h4 className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted">Recent listings</h4>
            <RecentListings creatorId={rater.id} />
          </section>
        )}

        {rater && (
          <DialogFooter className="flex-wrap gap-2 sm:justify-start">
            <Button onClick={() => onMessage(rater)}>
              <Megaphone /> Message as Shopi team
            </Button>
            {rater.email && (
              <Button asChild variant="outline">
                <a href={`mailto:${rater.email}`}>
                  <Mail /> Email
                </a>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/users?search=${encodeURIComponent(rater.email || rater.username || rater.id)}`}>
                <UserRound /> Open user record
              </Link>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
