"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useFragment } from "@apollo/client/react";
import { AlertTriangle, ExternalLink, Flag, Loader2, Rocket } from "lucide-react";
import { ADMIN_CONTENT_FIELDS } from "@/graphql/operations";
import {
  ContentCreationMethod,
  ContentSource,
  ContentStatus,
  ContentType,
  MediaProcessingStatus,
  type AdminContent,
} from "@/graphql/types";
import { displayName, formatDate, formatNumber, formatPrice, formatRelative } from "@/lib/format";
import { boostRunLabel } from "@/lib/boost";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { Person } from "@/components/shared/page";
import { MuxVideo } from "./mux-video";
import { PostActionBar } from "./post-actions";
import { isTiktokImport, referrerLabel } from "./post-badges";

/**
 * The post as it is in the cache right now. Moderation mutations return the
 * full post, so after approving or hiding, the open panel updates in place
 * instead of showing the state it was opened with.
 */
export function useLivePost(post: AdminContent): AdminContent {
  const { complete, data } = useFragment({
    fragment: ADMIN_CONTENT_FIELDS,
    fragmentName: "AdminContentFields",
    from: { __typename: "Content", id: post.id },
  });
  if (!complete || !data) return post;
  const live = data as unknown as AdminContent;
  // Keep fields only the list selected (e.g. the seller's referral).
  return { ...post, ...live, creator: post.creator ? { ...post.creator, ...live.creator } : live.creator };
}

/**
 * Status plus the conditions an admin needs to see at a glance. List rows
 * pass `showBoost={false}`: they show the boost under the title instead.
 */
export function PostStatusLine({ post, showBoost = true }: { post: AdminContent; showBoost?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge status={post.status} />
      {post.status === ContentStatus.PROCESSING && post.approval.isApproved && (
        <Badge variant="secondary">Approved · media processing</Badge>
      )}
      {post.status === ContentStatus.ACTIVE && !post.isLive && <Badge variant="secondary">Not live</Badge>}
      {post.moderation.isReported && (
        <Badge variant="destructive">
          <Flag /> {post.moderation.reportCount} report{post.moderation.reportCount === 1 ? "" : "s"}
        </Badge>
      )}
      {showBoost && post.boost?.isBoosted && (
        <Badge variant="accent">
          <Rocket /> <span className="capitalize">{post.boost.tier?.toLowerCase()}</span> ·{" "}
          {boostRunLabel(post.boost)}
        </Badge>
      )}
    </div>
  );
}

function PostMedia({ post }: { post: AdminContent }) {
  const [index, setIndex] = useState(0);
  const media = post.media ?? [];
  const first = media[0];

  if (post.source === ContentSource.TIKTOK_EMBED && post.tiktokEmbed) {
    return (
      <div className="space-y-2">
        {post.tiktokEmbed.coverImageUrl ? (
          <img
            src={post.tiktokEmbed.coverImageUrl}
            alt=""
            className="aspect-[9/16] w-full rounded-lg bg-black object-cover"
          />
        ) : (
          <div className="flex aspect-[9/16] items-center justify-center rounded-lg bg-subtle text-sm text-muted">
            TikTok video
          </div>
        )}
        <a
          href={post.tiktokEmbed.shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Watch on TikTok <ExternalLink className="size-3" />
        </a>
      </div>
    );
  }

  if (post.type === ContentType.VIDEO && first) {
    const playbackId = first.muxMeta?.playbackId;
    const poster = first.thumbnailUrl || first.muxMeta?.thumbnailUrl;
    if (playbackId) return <MuxVideo playbackId={playbackId} poster={poster} title={post.title} />;

    const failed =
      first.processingStatus === MediaProcessingStatus.ERRORED || post.status === ContentStatus.FAILED;
    return (
      <div className="relative flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg bg-black px-6 text-center">
        {poster && <img src={poster} alt="" className="absolute inset-0 size-full object-cover opacity-40" />}
        <div className="relative flex flex-col items-center gap-2 text-white">
          {failed ? <AlertTriangle className="size-6" /> : <Loader2 className="size-6 animate-spin" />}
          <p className="text-sm font-medium">{failed ? "Video didn't process" : "Video still processing"}</p>
          {failed && post.processingError && (
            <p className="text-xs text-white/70">{post.processingError}</p>
          )}
        </div>
      </div>
    );
  }

  const images = media
    .map((item) => item.imageUrl || item.thumbnailUrl || item.url)
    .filter((url): url is string => Boolean(url));
  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-subtle text-sm text-muted">
        No media
      </div>
    );
  }
  const current = images[Math.min(index, images.length - 1)];
  return (
    <div className="space-y-2">
      <img src={current} alt={post.title} className="aspect-square w-full rounded-lg bg-subtle object-cover" />
      {images.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {images.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Image ${i + 1}`}
              className={cn(
                "size-12 shrink-0 overflow-hidden rounded-md border-2",
                i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <img src={url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  );
}

/** Everything about one post and every action on it — the body of the post panel. */
export function PostDetail({ post: initial, onApproved }: { post: AdminContent; onApproved?: () => void }) {
  const post = useLivePost(initial);
  const referredBy = post.creator?.referredBy;
  const place = [post.location?.placeName, post.location?.subregion, post.location?.county]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,13rem)_1fr]">
        <div className="mx-auto w-full max-w-[13rem]">
          <PostMedia key={post.id} post={post} />
        </div>
        <div className="min-w-0 space-y-4">
          <PostStatusLine post={post} />
          <div>
            <p className="text-lg font-semibold tabular-nums text-foreground">{formatPrice(post.price)}</p>
            {post.price?.negotiable && <p className="text-xs text-muted">Negotiable</p>}
          </div>
          <PostActionBar post={post} onApproved={onApproved} />
          {post.approval.rejectionReason && post.status === ContentStatus.REJECTED && (
            <p className="rounded-lg bg-error-soft px-3 py-2 text-[13px] text-error">
              Rejected: {post.approval.rejectionReason}
            </p>
          )}
          {post.processingError && post.status !== ContentStatus.ACTIVE && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-secondary-strong">
              {post.processingError}
            </p>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-border p-3">
        <p className="mb-2 text-xs font-medium text-muted">Seller</p>
        <Person
          name={displayName(post.creator)}
          avatar={post.creator?.profile?.avatar}
          secondary={[post.creator?.username && `@${post.creator.username}`, post.creator?.email]
            .filter(Boolean)
            .join(" · ")}
        />
      </section>

      {(post.caption || post.hashtags.length > 0) && (
        <section>
          <p className="mb-1.5 text-xs font-medium text-muted">Description</p>
          {post.caption && <p className="whitespace-pre-wrap text-sm text-foreground">{post.caption}</p>}
          {post.hashtags.length > 0 && (
            <p className="mt-2 text-[13px] text-primary">{post.hashtags.map((tag) => `#${tag}`).join(" ")}</p>
          )}
        </section>
      )}

      <dl className="divide-y divide-border rounded-xl border border-border px-3">
        <Detail label="Listing no.">
          <span className="font-mono text-[13px]">{post.listingNumber}</span>
        </Detail>
        <Detail label="Posted">
          <span title={formatDate(post.createdAt)}>{formatRelative(post.createdAt)}</span>
        </Detail>
        <Detail label="Location">{place || "—"}</Detail>
        <Detail label="Engagement">
          {formatNumber(post.stats.views)} views · {formatNumber(post.stats.saves)} saves ·{" "}
          {formatNumber(post.stats.comments)} comments
        </Detail>
        <Detail label="Written by">
          {post.creationMethod === ContentCreationMethod.AGENT
            ? "Shopi Agent"
            : post.creationMethod === ContentCreationMethod.MANUAL
              ? "Seller (manual)"
              : "Not recorded"}
        </Detail>
        <Detail label="Upload method">
          {post.isBulk ? "Bulk upload" : "Individual post"}
        </Detail>
        <Detail label="TikTok import">
          {isTiktokImport(post) === true
            ? post.tiktokEmbed?.authorUsername
              ? `Yes · @${post.tiktokEmbed.authorUsername}`
              : "Yes"
            : isTiktokImport(post) === false
              ? "No"
              : "Not recorded"}
        </Detail>
        {post.source === ContentSource.TIKTOK_EMBED && post.tiktokEmbed && (
          <Detail label="TikTok source">
            <a
              href={post.tiktokEmbed.shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              TikTok embed · @{post.tiktokEmbed.authorUsername || "unknown"}
            </a>
          </Detail>
        )}
        <Detail label="Referral">
          {!post.creator ? (
            "Not available"
          ) : referredBy ? (
            <span>
              Yes · {referrerLabel(referredBy)} · {referredBy.source === "LINK" ? "invite link" : "code"} {referredBy.code}
            </span>
          ) : (
            "No"
          )}
        </Detail>
        <Detail label="Approved">
          {post.approval.isApproved && post.approval.approvedAt ? formatDate(post.approval.approvedAt) : "No"}
        </Detail>
      </dl>
    </div>
  );
}

/** The post panel on the posts screen. */
export function PostSheet({
  post,
  open,
  onOpenChange,
}: {
  post: AdminContent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        {post && (
          <>
            <SheetHeader>
              <SheetTitle className="truncate">{post.title}</SheetTitle>
              <SheetDescription>
                {post.listingNumber} · {displayName(post.creator)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <PostDetail post={post} onApproved={() => onOpenChange(false)} />
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
