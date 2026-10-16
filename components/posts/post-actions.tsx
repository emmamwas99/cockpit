"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Images,
  LifeBuoy,
  Loader2,
  MoreHorizontal,
  Rocket,
  Trash2,
  X,
} from "lucide-react";
import {
  ADMIN_RECOVER_POST_MEDIA,
  ADMIN_REMOVE_CONTENT,
  APPROVE_CONTENT,
  REJECT_CONTENT,
  SET_CONTENT_LIVE,
} from "@/graphql/operations";
import {
  ContentSource,
  ContentStatus,
  MediaProcessingStatus,
  type AdminContent,
} from "@/graphql/types";
import { postPublicState, postPublicUrl } from "@/lib/post-url";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PostMediaDialog } from "./post-media-dialog";
import { PostBoostDialog } from "./post-boost-dialog";

/** Every list that can show a post, refreshed after any action on one. */
export const POST_REFETCH = [
  "AdminContent",
  "AdminContentCounts",
  "AdminDashboardStats",
  "AdminPendingReviewCount",
  "PendingApprovalContent",
];

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

/**
 * Uploaded media that never finished — a video still "processing" or a post
 * failed by its media. What "Recover media" can fix from the R2 original.
 */
export function needsMediaRecovery(post: AdminContent): boolean {
  if (post.source === ContentSource.TIKTOK_EMBED || post.status === ContentStatus.REMOVED) return false;
  return (
    post.status === ContentStatus.PROCESSING ||
    post.status === ContentStatus.FAILED ||
    (post.media ?? []).some(
      (item) => item.processingStatus && item.processingStatus !== MediaProcessingStatus.READY,
    )
  );
}

export interface PostAction {
  key: "view" | "approve" | "reject" | "hide" | "live" | "boost" | "recover" | "media" | "remove";
  label: string;
  icon: typeof Check;
  onSelect: () => void;
  destructive?: boolean;
  loading?: boolean;
}

/**
 * Everything an admin can do to one post, given its state, plus the dialogs
 * those actions open. The row menu, the quick approve/reject buttons and the
 * detail panel all render from this, so they can never disagree.
 */
export function usePostActions(post: AdminContent) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [removeReason, setRemoveReason] = useState("");

  const [approve, { loading: approving }] = useMutation(APPROVE_CONTENT, { refetchQueries: POST_REFETCH });
  const [reject, { loading: rejecting }] = useMutation(REJECT_CONTENT, { refetchQueries: POST_REFETCH });
  const [setLive, { loading: togglingLive }] = useMutation(SET_CONTENT_LIVE, { refetchQueries: POST_REFETCH });
  const [remove, { loading: removing }] = useMutation(ADMIN_REMOVE_CONTENT, { refetchQueries: POST_REFETCH });
  const [recoverMedia, { loading: recovering }] = useMutation(ADMIN_RECOVER_POST_MEDIA, {
    refetchQueries: POST_REFETCH,
  });

  async function handleApprove() {
    try {
      const { data } = await approve({ variables: { contentId: post.id } });
      const approved = data?.approveContent;
      toast.success(
        approved?.status === ContentStatus.PROCESSING
          ? "Approved — it goes live when its media finishes processing"
          : "Approved and live",
      );
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Add a reason — the seller will see it");
      return;
    }
    try {
      await reject({ variables: { contentId: post.id, reason: rejectReason.trim() } });
      toast.success("Rejected — the seller has been told why");
      setRejectOpen(false);
      setRejectReason("");
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  async function handleSetLive(live: boolean) {
    try {
      await setLive({ variables: { contentId: post.id, live } });
      toast.success(live ? "Live again" : "Hidden from buyers");
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  /**
   * Finish this post's media now. The API asks Mux directly and re-sends the
   * R2 original if Mux has nothing usable, waiting up to 25s, so a short video
   * usually comes back finished. The returned post updates the open panel.
   */
  async function handleRecoverMedia() {
    try {
      const { data } = await recoverMedia({ variables: { contentId: post.id } });
      const result = data?.adminRecoverPostMedia;
      if (!result) return;

      if (result.missing > 0) {
        toast.error("Couldn't recover: the original upload isn't in storage", {
          description: "Use Replace media to upload it again.",
        });
      } else if (result.failed > 0) {
        toast.error("The original couldn't be processed", { description: result.details.join(" · ") });
      } else if (result.processing > 0) {
        toast.info("Sent to Mux — still encoding", {
          description: "It finishes on its own, or press Recover media again in a minute.",
        });
      } else {
        const after = result.content;
        toast.success(
          after.status === ContentStatus.ACTIVE
            ? "Media recovered — the post is live"
            : after.approval.isApproved
              ? "Media recovered"
              : "Media recovered — ready to review",
        );
      }
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  async function handleRemove() {
    try {
      await remove({ variables: { contentId: post.id, reason: removeReason.trim() || null } });
      toast.success("Removed");
      setRemoveOpen(false);
      setRemoveReason("");
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  const status = post.status;
  const canApprove = status === ContentStatus.PENDING_REVIEW || status === ContentStatus.REJECTED;
  const canReject = status === ContentStatus.PENDING_REVIEW;
  const canHide = status === ContentStatus.ACTIVE;
  const canMakeLive =
    (status === ContentStatus.UNDER_REVIEW || status === ContentStatus.REMOVED) &&
    post.approval.isApproved;

  const all: (PostAction & { visible: boolean })[] = [
    {
      key: "approve",
      label: "Approve",
      icon: Check,
      onSelect: () => void handleApprove(),
      visible: canApprove,
      loading: approving,
    },
    {
      key: "reject",
      label: "Reject",
      icon: X,
      onSelect: () => setRejectOpen(true),
      visible: canReject,
    },
    {
      key: "hide",
      label: "Hide from buyers",
      icon: EyeOff,
      onSelect: () => void handleSetLive(false),
      visible: canHide,
      loading: togglingLive,
    },
    {
      key: "live",
      label: "Make live",
      icon: Eye,
      onSelect: () => void handleSetLive(true),
      visible: canMakeLive,
      loading: togglingLive,
    },
    {
      key: "boost",
      label: post.boost?.isBoosted ? "Manage boost" : "Boost",
      icon: Rocket,
      onSelect: () => setBoostOpen(true),
      // Only a live post is in a feed for the boost to lift.
      visible: status === ContentStatus.ACTIVE,
    },
    {
      key: "view",
      label: "View on Shopi",
      icon: ExternalLink,
      onSelect: () => window.open(postPublicUrl(post), "_blank", "noopener,noreferrer"),
      // The public site only serves live posts; anything else is "not found".
      visible: postPublicState(post).isPublic,
    },
    {
      key: "recover",
      label: "Recover media",
      icon: LifeBuoy,
      onSelect: () => void handleRecoverMedia(),
      visible: needsMediaRecovery(post),
      loading: recovering,
    },
    {
      key: "media",
      label: "Replace media",
      icon: Images,
      onSelect: () => setMediaOpen(true),
      // The repair hatch for failed uploads, so available in every state.
      visible: true,
    },
    {
      key: "remove",
      label: "Remove",
      icon: Trash2,
      onSelect: () => setRemoveOpen(true),
      visible: status !== ContentStatus.REMOVED,
      destructive: true,
    },
  ];
  const actions: PostAction[] = all.filter((action) => action.visible);

  const dialogs = (
    <>
      <PostBoostDialog post={post} open={boostOpen} onOpenChange={setBoostOpen} />
      <PostMediaDialog post={post} open={mediaOpen} onOpenChange={setMediaOpen} />

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) setRejectReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this post?</DialogTitle>
            <DialogDescription>
              “{post.title}” will be hidden and the seller emailed your reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`reject-${post.id}`}>Reason</Label>
            <Textarea
              id={`reject-${post.id}`}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Photos are too blurry to show the product"
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleReject()} loading={rejecting}>
              Reject post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeOpen}
        onOpenChange={(open) => {
          setRemoveOpen(open);
          if (!open) setRemoveReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this post?</DialogTitle>
            <DialogDescription>
              “{post.title}” comes down everywhere. Its approval is kept, so “Make live” can restore it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`remove-${post.id}`}>Reason (optional)</Label>
            <Textarea
              id={`remove-${post.id}`}
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="Shown to the seller"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleRemove()} loading={removing}>
              Remove post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return { actions, dialogs, busy: approving || rejecting || togglingLive || removing || recovering };
}

function ActionMenuItems({ actions }: { actions: PostAction[] }) {
  const safe = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);
  return (
    <>
      {safe.map(({ key, label, icon: Icon, onSelect }) => (
        <DropdownMenuItem key={key} onSelect={onSelect}>
          <Icon /> {label}
        </DropdownMenuItem>
      ))}
      {destructive.length > 0 && safe.length > 0 && <DropdownMenuSeparator />}
      {destructive.map(({ key, label, icon: Icon, onSelect }) => (
        <DropdownMenuItem key={key} onSelect={onSelect} destructive>
          <Icon /> {label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/**
 * The actions cell of a post row: one-click approve/reject while a post waits
 * for review, and everything else under "⋯".
 */
export function PostRowActions({ post }: { post: AdminContent }) {
  const { actions, dialogs, busy } = usePostActions(post);
  const approve = actions.find((action) => action.key === "approve");
  const reject = actions.find((action) => action.key === "reject");
  const quick = post.status === ContentStatus.PENDING_REVIEW;

  return (
    // Rows open the post on click/Enter; actions inside them must not.
    <div
      className="flex items-center justify-end gap-1"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {quick && approve && (
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-success hover:bg-success-soft"
          onClick={approve.onSelect}
          disabled={busy}
          aria-label="Approve"
          title="Approve"
        >
          {approve.loading ? <Loader2 className="animate-spin" /> : <Check />}
        </Button>
      )}
      {quick && reject && (
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-error hover:bg-error-soft"
          onClick={reject.onSelect}
          disabled={busy}
          aria-label="Reject"
          title="Reject"
        >
          <X />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="More actions" disabled={busy && !quick}>
            {busy && !quick ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <ActionMenuItems
            actions={quick ? actions.filter((a) => a.key !== "approve" && a.key !== "reject") : actions}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </div>
  );
}

/**
 * The action bar of the post detail panel: the state's main moves as buttons
 * (approve/reject, hide/make live, boost), the rest under "More".
 */
export function PostActionBar({ post, className }: { post: AdminContent; className?: string }) {
  const { actions, dialogs, busy } = usePostActions(post);
  // "Recover media" only shows while media is unfinished, and then it's the
  // thing to do first, so it sits with the main moves.
  const primaryKeys: PostAction["key"][] = ["approve", "reject", "hide", "live", "boost", "recover"];
  const primary = actions.filter((action) => primaryKeys.includes(action.key));
  const rest = actions.filter((action) => !primaryKeys.includes(action.key));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {primary.map(({ key, label, icon: Icon, onSelect, loading }) => (
        <Button
          key={key}
          size="sm"
          variant={key === "approve" ? "default" : key === "reject" ? "outline" : "outline"}
          className={cn(key === "reject" && "text-error hover:bg-error-soft")}
          onClick={onSelect}
          disabled={busy}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Icon />}
          {label}
        </Button>
      ))}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy}>
              <MoreHorizontal /> More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <ActionMenuItems actions={rest} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {dialogs}
    </div>
  );
}
