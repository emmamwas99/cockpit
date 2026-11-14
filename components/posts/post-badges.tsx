import { Clapperboard, FileSpreadsheet, Gift, ImageIcon, Music2, PenLine, Sparkles, Type, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { displayName, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  BoostTier,
  ContentCreationMethod,
  ContentSource,
  ContentType,
  ReferralStatus,
  type AdminContent,
  type AdminReferredBy,
} from "@/graphql/types";

const TIER_NAME: Record<BoostTier, string> = {
  [BoostTier.SILVER]: "Silver",
  [BoostTier.GOLD]: "Gold",
  [BoostTier.PLATINUM]: "Platinum",
};

/** The post's running boost and how long it has left, or null once its end date has passed. */
export function liveBoost(post: Pick<AdminContent, "boost">) {
  const boost = post.boost;
  if (!boost?.isBoosted || !boost.expiresAt) return null;
  const msLeft = new Date(boost.expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return null;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return {
    tier: boost.tier ? TIER_NAME[boost.tier] : null,
    expiresAt: boost.expiresAt,
    left: daysLeft > 1 ? `${daysLeft} days left` : msLeft > 60 * 60 * 1000 ? "ends today" : "ending now",
  };
}

/** "⚡ Boosted · Gold · 10 days left" while a campaign runs; nothing once it has ended. */
export function BoostedBadge({ post }: { post: Pick<AdminContent, "boost"> }) {
  const boost = liveBoost(post);
  if (!boost) return null;
  return (
    <Badge title={`Boosted until ${formatDate(boost.expiresAt)}`}>
      <Zap className="fill-current" />
      Boosted{boost.tier ? ` · ${boost.tier}` : ""} · {boost.left}
    </Badge>
  );
}

const WRITER = {
  [ContentCreationMethod.AGENT]: "written by Shopi Agent",
  [ContentCreationMethod.MANUAL]: "written by the seller",
} as const;

/**
 * How the listing was posted: a bulk upload, Shopi Agent, or the seller by
 * hand. Bulk is the route, so it wins; who wrote the words goes in the hover
 * text. Posts from before this was recorded show nothing rather than a guess.
 */
export function PostedViaBadge({ post }: { post: Pick<AdminContent, "isBulk" | "creationMethod"> }) {
  if (post.isBulk) {
    return (
      <Badge
        variant="outline"
        title={`Bulk upload${post.creationMethod ? `, ${WRITER[post.creationMethod]}` : ""}`}
      >
        <FileSpreadsheet />
        Bulk upload
      </Badge>
    );
  }
  if (post.creationMethod === ContentCreationMethod.AGENT) {
    return (
      <Badge variant="accent" title="Shopi Agent drafted it; the seller reviewed and posted">
        <Sparkles />
        Agent
      </Badge>
    );
  }
  if (post.creationMethod === ContentCreationMethod.MANUAL) {
    return (
      <Badge variant="secondary" title="The seller wrote it themselves">
        <PenLine />
        Manual
      </Badge>
    );
  }
  return null;
}

/** The badges a post row carries under its title. Renders nothing when there are none. */
export function PostListBadges({
  post,
  className,
}: {
  post: Pick<AdminContent, "boost" | "isBulk" | "creationMethod">;
  className?: string;
}) {
  const boosted = Boolean(liveBoost(post));
  const via = Boolean(post.isBulk || post.creationMethod);
  if (!boosted && !via) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <BoostedBadge post={post} />
      <PostedViaBadge post={post} />
    </div>
  );
}

/** "by Jane Doe", or a note that the inviter's account is gone. */
export function referrerLabel(referredBy: AdminReferredBy): string {
  return referredBy.referrer ? `by ${displayName(referredBy.referrer)}` : "by a deleted account";
}

/**
 * Whether the post's seller joined through someone's invite, with the inviter
 * underneath. A referred seller's live listings count toward that inviter's
 * reward, so it is worth knowing while approving.
 */
export function ReferredBadge({ post }: { post: Pick<AdminContent, "creator"> }) {
  if (!post.creator) {
    return (
      <span className="text-sm text-muted" title="Creator account not found">
        —
      </span>
    );
  }

  const referredBy = post.creator.referredBy;
  if (!referredBy) return <span className="text-sm text-muted">No</span>;

  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge className="flex w-fit items-center gap-1">
        <Gift className="size-3.5" />
        Yes
      </Badge>
      <span
        className="max-w-[140px] truncate text-[11px] text-muted"
        title={referredBy.referrer?.email ?? undefined}
      >
        {referrerLabel(referredBy)}
      </span>
      {referredBy.status === ReferralStatus.REJECTED && (
        <span className="text-[11px] text-error">referral rejected</span>
      )}
    </div>
  );
}

/** The media type. Always VIDEO or IMAGE — a TikTok import is still a video. */
export function PostTypeBadge({ post }: { post: Pick<AdminContent, "type"> }) {
  const { label, Icon } =
    post.type === ContentType.VIDEO
      ? { label: "Video", Icon: Clapperboard }
      : post.type === ContentType.IMAGE
        ? { label: "Image", Icon: ImageIcon }
        : { label: "Text", Icon: Type };
  return (
    <Badge variant="secondary" className="flex w-fit items-center gap-1">
      <Icon className="size-3.5" />
      {label}
    </Badge>
  );
}

/**
 * Whether the post was made from a TikTok video.
 *
 * `true`/`false` come from `isTiktokImport`. TIKTOK_EMBED posts predate the flag
 * but are TikTok imports by definition, so they read as true. Anything else
 * with no stored value was published before this was recorded, so it is
 * `null` ("not recorded") rather than a guessed false.
 */
export function isTiktokImport(
  post: Pick<AdminContent, "source" | "isTiktokImport">,
): boolean | null {
  if (post.isTiktokImport === true || post.source === ContentSource.TIKTOK_EMBED) return true;
  if (post.isTiktokImport === false) return false;
  return null;
}

export function TiktokImportBadge({
  post,
}: {
  post: Pick<AdminContent, "source" | "isTiktokImport">;
}) {
  const value = isTiktokImport(post);
  if (value === true) {
    return (
      <Badge className="flex w-fit items-center gap-1">
        <Music2 className="size-3.5" />
        Yes
      </Badge>
    );
  }
  if (value === false) return <span className="text-sm text-muted">No</span>;
  return (
    <span className="text-sm text-muted" title="Posted before this was recorded">
      —
    </span>
  );
}
