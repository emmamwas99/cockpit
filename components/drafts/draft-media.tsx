"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { AlertTriangle, ImageIcon, Loader2, Play } from "lucide-react";
import { DraftMediaHealth, type AdminDraft, type AdminDraftMedia } from "@/graphql/types";
import { formatPrice, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MuxVideo } from "@/components/posts/mux-video";
import { MediaHealthBadge, isBrokenMedia, mediaNoun } from "./draft-status";

function coverOf(draft: AdminDraft): AdminDraftMedia | undefined {
  return (
    draft.media.find((item) => item.health === DraftMediaHealth.READY && item.thumbnailUrl) ??
    draft.media.find((item) => item.thumbnailUrl)
  );
}

/** The draft's cover, with how many items it holds and whether any broke. */
export function DraftThumb({ draft, className = "size-10" }: { draft: AdminDraft; className?: string }) {
  const cover = coverOf(draft);
  const isVideo = draft.type === "VIDEO";
  const broken = draft.unusableMediaCount > 0;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-md border border-border bg-subtle", className)}>
      {cover?.thumbnailUrl ? (
        <img src={cover.thumbnailUrl} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted">
          {broken ? <AlertTriangle className="size-4 text-error" /> : <ImageIcon className="size-4" />}
        </div>
      )}
      {isVideo && cover?.thumbnailUrl && (
        <span className="absolute bottom-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white">
          <Play className="size-2.5 fill-current" aria-label="Video" />
        </span>
      )}
      {!isVideo && draft.media.length > 1 && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[10px] font-medium leading-4 text-white">
          {draft.media.length}
        </span>
      )}
      {broken && cover?.thumbnailUrl && (
        <span className="absolute left-0.5 top-0.5 size-2 rounded-full bg-error ring-2 ring-elevated" aria-label="Some media failed" />
      )}
    </div>
  );
}

/** Thumbnail, title, then how much media and the price — the first cell of a draft row. */
export function DraftCell({ draft, className }: { draft: AdminDraft; className?: string }) {
  const count = draft.media.length;
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <DraftThumb draft={draft} />
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-medium", draft.title ? "text-foreground" : "text-muted")}>
          {draft.title?.trim() || "Untitled draft"}
        </p>
        <p className="truncate text-xs text-muted">
          {count === 0 ? `No ${mediaNoun(draft)}` : `${count} ${mediaNoun(draft, count)}`}
          {draft.price ? ` · ${formatPrice(draft.price)}` : ""}
        </p>
      </div>
    </div>
  );
}

function BrokenTile({ item, large = false }: { item: AdminDraftMedia; large?: boolean }) {
  const pending = item.health === DraftMediaHealth.UPLOADING || item.health === DraftMediaHealth.PROCESSING;
  return (
    <div
      className={cn(
        "flex size-full flex-col items-center justify-center gap-1.5 text-center",
        pending ? "bg-subtle text-muted" : "bg-error-soft text-error",
        large && "px-6",
      )}
    >
      {pending ? (
        <Loader2 className={cn("animate-spin", large ? "size-6" : "size-3.5")} />
      ) : (
        <AlertTriangle className={large ? "size-6" : "size-3.5"} />
      )}
      {large && (
        <p className="text-sm font-medium">
          {pending ? "Not ready yet" : item.health === DraftMediaHealth.MISSING ? "File missing" : "Didn’t upload"}
        </p>
      )}
    </div>
  );
}

/** One media item at full size: the image, the video player, or what went wrong. */
function MediaViewer({ item, title }: { item: AdminDraftMedia; title?: string | null }) {
  if (item.type === "VIDEO" && item.muxPlaybackId && item.health === DraftMediaHealth.READY) {
    return <MuxVideo playbackId={item.muxPlaybackId} poster={item.thumbnailUrl} title={title ?? undefined} />;
  }
  const src = item.health === DraftMediaHealth.READY ? item.url || item.thumbnailUrl : null;
  return (
    <div className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-subtle">
      {src ? <img src={src} alt={title ?? ""} className="size-full object-cover" /> : <BrokenTile item={item} large />}
    </div>
  );
}

/** The draft's media in post order: a viewer, and a strip that marks what broke. */
export function DraftMediaGallery({ draft }: { draft: AdminDraft }) {
  const [index, setIndex] = useState(0);
  const media = draft.media;

  if (media.length === 0) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg bg-subtle text-center text-sm text-muted">
        <ImageIcon className="size-5" />
        No {mediaNoun(draft)} yet
      </div>
    );
  }

  const current = media[Math.min(index, media.length - 1)];
  return (
    <div className="space-y-2">
      <MediaViewer key={current.id} item={current} title={draft.title} />
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular-nums">
          {Math.min(index, media.length - 1) + 1} of {media.length}
        </span>
        <MediaHealthBadge health={current.health} />
      </div>
      {media.length > 1 && (
        <div className="grid grid-cols-5 gap-1.5">
          {media.map((item, i) => {
            const broken = isBrokenMedia(item.health);
            const showImage = item.thumbnailUrl && item.health === DraftMediaHealth.READY;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${mediaNoun(draft, 1)} ${i + 1}${broken ? ", failed" : ""}`}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md border-2",
                  i === index ? "border-primary" : broken ? "border-error/50" : "border-transparent",
                  i !== index && "opacity-80 hover:opacity-100",
                )}
              >
                {showImage ? (
                  <img src={item.thumbnailUrl!} alt="" className="size-full object-cover" />
                ) : (
                  <BrokenTile item={item} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Every item that isn't ready, with what went wrong in plain words. */
export function DraftMediaProblems({ draft }: { draft: AdminDraft }) {
  const items = draft.media
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.health !== DraftMediaHealth.READY);
  if (items.length === 0) return null;

  return (
    <section>
      <p className="mb-1.5 text-xs font-medium text-muted">
        {mediaNoun(draft, 1) === "video" ? "Video" : "Photos"} that need attention
      </p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {items.map(({ item, index }) => (
          <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
            <span className="mt-0.5 w-6 shrink-0 text-xs tabular-nums text-muted">#{index + 1}</span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <MediaHealthBadge health={item.health} />
                {item.retryable && <span className="text-xs text-muted">Retry may fix this</span>}
                {item.updatedAt && (
                  <span className="text-xs text-placeholder">· {formatRelative(item.updatedAt)}</span>
                )}
              </div>
              {item.problem && <p className="text-[13px] text-foreground">{item.problem}</p>}
              {item.errorMessage && (
                <p className="break-words font-mono text-[11px] text-muted">{item.errorMessage}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
