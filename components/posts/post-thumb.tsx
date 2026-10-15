/* eslint-disable @next/next/no-img-element */
import { Clapperboard, ImageIcon, Play } from "lucide-react";
import { ContentType, type AdminContent } from "@/graphql/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export function postThumbUrl(post: AdminContent): string | null {
  const media = post.media?.[0];
  return (
    media?.thumbnailUrl ||
    media?.muxMeta?.thumbnailUrl ||
    media?.imageUrl ||
    post.tiktokEmbed?.coverImageUrl ||
    null
  );
}

/** The post's cover; videos carry a small play mark instead of a "Type" column. */
export function PostThumb({ post, className = "size-10" }: { post: AdminContent; className?: string }) {
  const url = postThumbUrl(post);
  const isVideo = post.type === ContentType.VIDEO;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-md border border-border bg-subtle", className)}>
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted">
          {isVideo ? <Clapperboard className="size-4" /> : <ImageIcon className="size-4" />}
        </div>
      )}
      {isVideo && url && (
        <span className="absolute bottom-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white">
          <Play className="size-2.5 fill-current" aria-label="Video" />
        </span>
      )}
    </div>
  );
}

/** Thumbnail, title, then listing number and price — the first cell of any post row. */
export function PostCell({ post, className }: { post: AdminContent; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <PostThumb post={post} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{post.title || "Untitled"}</p>
        <p className="truncate text-xs text-muted">
          <span className="font-mono">{post.listingNumber}</span> · {formatPrice(post.price)}
        </p>
      </div>
    </div>
  );
}
