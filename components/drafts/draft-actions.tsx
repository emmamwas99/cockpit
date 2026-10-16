"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { CombinedGraphQLErrors, ServerError } from "@apollo/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  ImageOff,
  Loader2,
  MoreHorizontal,
  PencilLine,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import {
  ADMIN_DISCARD_DRAFT,
  ADMIN_PUBLISH_DRAFT,
  ADMIN_REMOVE_DRAFT_UNUSABLE_MEDIA,
  ADMIN_RETRY_DRAFT_MEDIA,
  ADMIN_UPDATE_DRAFT_DETAILS,
} from "@/graphql/operations";
import {
  AdminDraftIssueCode,
  ContentStatus,
  DraftStatus,
  type AdminDraft,
} from "@/graphql/types";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { POST_REFETCH } from "@/components/posts/post-actions";
import { mediaNoun } from "./draft-status";

/** Every list that can show a draft, refreshed after any action on one. */
export const DRAFT_REFETCH = ["AdminDrafts", "AdminDraftCounts"];

/**
 * The API's own words where it gave any — its refusals are written to be
 * shown as they are — and plain ones for the failures it couldn't explain.
 */
export function describeError(err: unknown): string {
  if (CombinedGraphQLErrors.is(err)) {
    const message = err.errors.map((e) => e.message).join("\n");
    if (/^internal server error$/i.test(message.trim())) {
      return "The API hit an unexpected error and didn’t say why. It has been logged on the server; try again, and check the API logs if it keeps happening.";
    }
    return message;
  }
  if (ServerError.is(err)) {
    return `The API answered with an error (HTTP ${err.statusCode}). Try again in a moment.`;
  }
  if (err instanceof Error) {
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(err.message)) {
      return "Couldn’t reach the Shopi API. Check your connection and try again.";
    }
    return err.message;
  }
  return "Something went wrong.";
}

type ActionKey = "publish" | "retry" | "removeBroken" | "edit" | "copy" | "viewPost" | "discard";

interface DraftAction {
  key: ActionKey;
  label: string;
  icon: typeof Send;
  onSelect: () => void;
  destructive?: boolean;
  loading?: boolean;
}

interface Failure {
  action: "publish" | "retry" | "removeBroken" | "edit" | "discard";
  message: string;
}

const FAILURE_TITLES: Record<Failure["action"], string> = {
  publish: "Couldn’t publish this draft",
  retry: "Couldn’t retry the media",
  removeBroken: "Couldn’t remove the failed media",
  edit: "Couldn’t save the changes",
  discard: "Couldn’t discard this draft",
};

/**
 * Everything an admin can do to one draft, given its state, plus the dialogs
 * those actions open. The row menu and the panel's action bar both render
 * from this, so they can never disagree.
 */
export function useDraftActions(draft: AdminDraft) {
  const router = useRouter();
  const [publishOpen, setPublishOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const [publish, { loading: publishing }] = useMutation(ADMIN_PUBLISH_DRAFT, {
    refetchQueries: [...DRAFT_REFETCH, ...POST_REFETCH],
  });
  const [retry, { loading: retrying }] = useMutation(ADMIN_RETRY_DRAFT_MEDIA, { refetchQueries: DRAFT_REFETCH });
  const [removeBroken, { loading: removing }] = useMutation(ADMIN_REMOVE_DRAFT_UNUSABLE_MEDIA, {
    refetchQueries: DRAFT_REFETCH,
  });
  const [discard, { loading: discarding }] = useMutation(ADMIN_DISCARD_DRAFT, { refetchQueries: DRAFT_REFETCH });

  const active = draft.status === DraftStatus.ACTIVE;
  const usable = draft.media.length - draft.unusableMediaCount;
  const canRetry = active && draft.media.some((item) => item.retryable);

  async function handlePublish(options: { removeUnusableMedia: boolean; approve: boolean }) {
    setFailure(null);
    try {
      const { data } = await publish({ variables: { id: draft.id, ...options } });
      const result = data?.adminPublishDraft;
      setPublishOpen(false);
      if (!result) return;
      const removed = result.removedMediaCount
        ? ` ${result.removedMediaCount} failed ${mediaNoun(draft, result.removedMediaCount)} removed.`
        : "";
      if (result.approvalError) {
        toast.warning("Published, but not approved", {
          description: `It is waiting in Posts › Pending review. Approval said: ${result.approvalError}`,
        });
      } else if (result.approved) {
        toast.success(
          result.content.status === ContentStatus.ACTIVE
            ? "Published and live"
            : "Published — it goes live when its media finishes processing",
          { description: removed.trim() || undefined },
        );
      } else {
        toast.success("Published — waiting in Posts › Pending review", { description: removed.trim() || undefined });
      }
    } catch (err) {
      setPublishOpen(false);
      setFailure({ action: "publish", message: describeError(err) });
    }
  }

  async function handleRetry() {
    setFailure(null);
    try {
      const { data } = await retry({ variables: { id: draft.id } });
      const result = data?.adminRetryDraftMedia;
      if (!result) return;
      const noun = (count: number) => mediaNoun(draft, count);
      if (result.requeued > 0) {
        toast.success(`Sent ${result.requeued} ${noun(result.requeued)} back for processing`, {
          description: [
            "They are usually ready within a minute — refresh to see.",
            result.unrecoverable > 0 &&
              `${result.unrecoverable} never reached our servers; only the seller can add ${result.unrecoverable === 1 ? "it" : "them"} again.`,
          ]
            .filter(Boolean)
            .join(" "),
        });
      } else {
        setFailure({
          action: "retry",
          message:
            result.unrecoverable > 0
              ? `Nothing could be retried: the original upload of ${result.unrecoverable === 1 ? "this file" : `these ${result.unrecoverable} files`} never reached our servers. Remove ${result.unrecoverable === 1 ? "it" : "them"} to publish the rest, or ask the seller to add ${result.unrecoverable === 1 ? "it" : "them"} again.`
              : "Nothing needed retrying — every item is ready or still on its way.",
        });
      }
    } catch (err) {
      setFailure({ action: "retry", message: describeError(err) });
    }
  }

  async function handleRemoveBroken() {
    setFailure(null);
    try {
      await removeBroken({ variables: { id: draft.id } });
      setRemoveOpen(false);
      toast.success(
        `Removed ${draft.unusableMediaCount} failed ${mediaNoun(draft, draft.unusableMediaCount)}`,
      );
    } catch (err) {
      setRemoveOpen(false);
      setFailure({ action: "removeBroken", message: describeError(err) });
    }
  }

  async function handleDiscard() {
    setFailure(null);
    try {
      await discard({ variables: { id: draft.id } });
      setDiscardOpen(false);
      toast.success("Draft discarded");
    } catch (err) {
      setDiscardOpen(false);
      setFailure({ action: "discard", message: describeError(err) });
    }
  }

  async function copyDetails(message?: string) {
    const text = [
      `Draft ${draft.id}`,
      `Seller ${displayName(draft.creator)}${draft.creator?.email ? ` <${draft.creator.email}>` : ""}`,
      message,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn’t copy — select the text instead");
    }
  }

  const all: (DraftAction & { visible: boolean })[] = [
    { key: "publish", label: "Publish", icon: Send, onSelect: () => setPublishOpen(true), visible: active, loading: publishing },
    { key: "retry", label: "Retry media", icon: RefreshCw, onSelect: () => void handleRetry(), visible: canRetry, loading: retrying },
    {
      key: "removeBroken",
      label: `Remove failed ${mediaNoun(draft)}`,
      icon: ImageOff,
      onSelect: () => setRemoveOpen(true),
      visible: active && draft.unusableMediaCount > 0,
    },
    { key: "edit", label: "Edit details", icon: PencilLine, onSelect: () => setEditOpen(true), visible: active },
    {
      key: "viewPost",
      label: "Open the post",
      icon: ExternalLink,
      onSelect: () => router.push(`/posts?tab=all&q=${draft.publishedContentId}`),
      visible: draft.status === DraftStatus.PUBLISHED && !!draft.publishedContentId,
    },
    { key: "copy", label: "Copy draft ID", icon: Copy, onSelect: () => void copyDetails(), visible: true },
    {
      key: "discard",
      label: "Discard draft",
      icon: Trash2,
      onSelect: () => setDiscardOpen(true),
      visible: active,
      destructive: true,
    },
  ];
  const actions: DraftAction[] = all.filter((action) => action.visible);

  const dialogs = (
    <>
      <PublishDraftDialog
        draft={draft}
        open={publishOpen}
        onOpenChange={setPublishOpen}
        publishing={publishing}
        onPublish={(options) => void handlePublish(options)}
        onEdit={() => {
          setPublishOpen(false);
          setEditOpen(true);
        }}
        onRetry={canRetry ? () => void handleRetry() : undefined}
      />

      <EditDraftDialog
        draft={draft}
        open={editOpen}
        onOpenChange={setEditOpen}
        onError={(message) => setFailure({ action: "edit", message })}
      />

      <DraftErrorDialog
        draft={draft}
        failure={failure}
        onClose={() => setFailure(null)}
        onCopy={(message) => void copyDetails(message)}
        onRemoveAndPublish={
          failure?.action === "publish" && draft.unusableMediaCount > 0 && usable > 0
            ? () => void handlePublish({ removeUnusableMedia: true, approve: true })
            : undefined
        }
        onRetry={canRetry && failure?.action !== "retry" ? () => void handleRetry() : undefined}
        onEdit={
          failure?.action === "publish" && draft.issues.some((issue) => EDITABLE_CODES.has(issue.code))
            ? () => {
                setFailure(null);
                setEditOpen(true);
              }
            : undefined
        }
        busy={publishing || retrying}
      />

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Remove {draft.unusableMediaCount} failed {mediaNoun(draft, draft.unusableMediaCount)}?
            </DialogTitle>
            <DialogDescription>
              {usable > 0
                ? `The draft keeps its other ${usable} and can then be published.`
                : `Nothing else is left on the draft, so the seller will have to add ${mediaNoun(draft)} again.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleRemoveBroken()} loading={removing}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Discard this draft?</DialogTitle>
            <DialogDescription>
              “{draft.title?.trim() || "Untitled draft"}” disappears from {displayName(draft.creator)}’s drafts.
              Its media is deleted after 24 hours. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDiscardOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDiscard()} loading={discarding}>
              Discard draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return { actions, dialogs, busy: publishing || retrying || removing || discarding };
}

/** Issues an admin can fix in Edit details. */
const EDITABLE_CODES = new Set([
  AdminDraftIssueCode.TITLE,
  AdminDraftIssueCode.DESCRIPTION,
  AdminDraftIssueCode.PRICE,
]);

function Checkbox({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function IssueList({ draft, onlyBlocking = false }: { draft: AdminDraft; onlyBlocking?: boolean }) {
  const issues = draft.issues.filter((issue) => !onlyBlocking || issue.blocking);
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {issues.map((issue) => (
        <li key={issue.code} className="flex items-start gap-2 text-[13px]">
          <span
            className={cn(
              "mt-1.5 size-1.5 shrink-0 rounded-full",
              issue.blocking ? "bg-error" : "bg-secondary-strong",
            )}
            aria-hidden
          />
          <span className="text-foreground">{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

/** Confirm a publish, with the choices that decide how it goes out. */
function PublishDraftDialog({
  draft,
  open,
  onOpenChange,
  publishing,
  onPublish,
  onEdit,
  onRetry,
}: {
  draft: AdminDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publishing: boolean;
  onPublish: (options: { removeUnusableMedia: boolean; approve: boolean }) => void;
  onEdit: () => void;
  onRetry?: () => void;
}) {
  const [removeUnusable, setRemoveUnusable] = useState(true);
  const [approve, setApprove] = useState(true);

  const total = draft.media.length;
  const broken = draft.unusableMediaCount;
  const usable = total - broken;
  const isEmbed = draft.source === "TIKTOK_EMBED";
  const nothingToPost = !isEmbed && (total === 0 || usable === 0);
  const otherBlocking = draft.issues.filter(
    (issue) =>
      issue.blocking &&
      issue.code !== AdminDraftIssueCode.MEDIA_UNUSABLE &&
      issue.code !== AdminDraftIssueCode.MEDIA_MISSING,
  );
  const pending = draft.issues.find((issue) => issue.code === AdminDraftIssueCode.MEDIA_PENDING);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Publish this draft?</DialogTitle>
          <DialogDescription>
            “{draft.title?.trim() || "Untitled draft"}” goes out for {displayName(draft.creator)}, exactly as they
            would have posted it.
          </DialogDescription>
        </DialogHeader>

        {nothingToPost ? (
          <div className="rounded-lg bg-error-soft px-3 py-2.5 text-[13px] text-error">
            {total === 0
              ? `There are no ${mediaNoun(draft)} on this draft, so there is nothing to show buyers.`
              : `None of the ${total} ${mediaNoun(draft, total)} uploaded, so there is nothing to publish.`}{" "}
            {onRetry ? "Retry media may rescue some; otherwise the seller has to add them again." : "The seller has to add them again."}
          </div>
        ) : (
          <div className="space-y-2">
            {broken > 0 && (
              <Checkbox
                id={`remove-broken-${draft.id}`}
                checked={removeUnusable}
                onChange={setRemoveUnusable}
                label={`Remove the ${broken} ${mediaNoun(draft, broken)} that didn’t upload`}
                hint={`The post goes out with the other ${usable}. Leave this off and the publish is refused.`}
              />
            )}
            <Checkbox
              id={`approve-${draft.id}`}
              checked={approve}
              onChange={setApprove}
              label="Approve it now"
              hint="Skips the review queue. Off: it waits in Posts › Pending review."
            />
          </div>
        )}

        {otherBlocking.length > 0 && (
          <div className="space-y-2 rounded-lg border border-warning-soft bg-warning-soft/40 px-3 py-2.5">
            <p className="text-[13px] font-medium text-foreground">The API will refuse this until these are fixed:</p>
            <ul className="space-y-1 text-[13px] text-foreground">
              {otherBlocking.map((issue) => (
                <li key={issue.code}>• {issue.message}</li>
              ))}
            </ul>
            {otherBlocking.some((issue) => EDITABLE_CODES.has(issue.code)) && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <PencilLine /> Edit details
              </Button>
            )}
          </div>
        )}

        {pending && !nothingToPost && <p className="text-xs text-muted">{pending.message}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {nothingToPost && onRetry ? (
            <Button
              onClick={() => {
                onOpenChange(false);
                onRetry();
              }}
            >
              <RefreshCw /> Retry media
            </Button>
          ) : (
            <Button
              onClick={() => onPublish({ removeUnusableMedia: broken > 0 && removeUnusable, approve })}
              loading={publishing}
              disabled={nothingToPost}
            >
              {!publishing && <Send />} Publish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The popup for a refused action: the API's own explanation, what is still
 * stopping the draft, and the fixes that apply — never just a passing toast.
 */
function DraftErrorDialog({
  draft,
  failure,
  onClose,
  onCopy,
  onRemoveAndPublish,
  onRetry,
  onEdit,
  busy,
}: {
  draft: AdminDraft;
  failure: Failure | null;
  onClose: () => void;
  onCopy: (message: string) => void;
  onRemoveAndPublish?: () => void;
  onRetry?: () => void;
  onEdit?: () => void;
  busy: boolean;
}) {
  const blocking = draft.issues.filter((issue) => issue.blocking);
  return (
    <Dialog open={failure !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {failure && (
          <>
            <DialogHeader className="items-center text-center sm:items-center sm:text-center">
              <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-error-soft text-error">
                <AlertTriangle className="size-5" />
              </span>
              <DialogTitle>{FAILURE_TITLES[failure.action]}</DialogTitle>
              <DialogDescription className="whitespace-pre-line text-[14px] leading-relaxed text-foreground">
                {failure.message}
              </DialogDescription>
            </DialogHeader>

            {failure.action === "publish" && blocking.length > 0 && (
              <div className="rounded-lg border border-border px-3 py-2.5">
                <p className="mb-1.5 text-xs font-medium text-muted">What’s stopping this draft</p>
                <IssueList draft={draft} onlyBlocking />
              </div>
            )}

            <div className="flex flex-col gap-2">
              {onRemoveAndPublish && (
                <Button onClick={onRemoveAndPublish} loading={busy}>
                  {!busy && <ImageOff />} Remove failed {mediaNoun(draft)} and publish
                </Button>
              )}
              {onRetry && (
                <Button variant="outline" onClick={onRetry} disabled={busy}>
                  <RefreshCw /> Retry media
                </Button>
              )}
              {onEdit && (
                <Button variant="outline" onClick={onEdit} disabled={busy}>
                  <PencilLine /> Edit details
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => onCopy(failure.message)}>
                  <Copy /> Copy details
                </Button>
                <Button variant="secondary" className="flex-1" onClick={onClose}>
                  Got it
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Correct the listing text or price. The API's checks then say whether it passes. */
function EditDraftDialog({
  draft,
  open,
  onOpenChange,
  onError,
}: {
  draft: AdminDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onError: (message: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {/* Mounted only while open, so each opening starts from the draft as it is now. */}
        {open && <EditDraftForm key={draft.id} draft={draft} onDone={() => onOpenChange(false)} onError={onError} />}
      </DialogContent>
    </Dialog>
  );
}

function EditDraftForm({
  draft,
  onDone,
  onError,
}: {
  draft: AdminDraft;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(draft.title ?? "");
  const [caption, setCaption] = useState(draft.caption ?? "");
  const [price, setPrice] = useState(draft.price ? String(draft.price.amount) : "");
  const [negotiable, setNegotiable] = useState(draft.price?.negotiable ?? false);
  const [save, { loading }] = useMutation(ADMIN_UPDATE_DRAFT_DETAILS, { refetchQueries: DRAFT_REFETCH });
  const [textProblems, setTextProblems] = useState<string[]>([]);

  const priceValue = price.trim() === "" ? undefined : Number(price);
  const priceInvalid = priceValue !== undefined && (!Number.isFinite(priceValue) || priceValue < 0);

  async function handleSave() {
    if (priceInvalid) return;
    try {
      // Only what changed, so fixing a title never writes a price the seller
      // didn't set.
      const input = {
        ...(title !== (draft.title ?? "") ? { title } : {}),
        ...(caption !== (draft.caption ?? "") ? { caption } : {}),
        ...(priceValue !== undefined && priceValue !== draft.price?.amount ? { priceAmount: priceValue } : {}),
        ...(negotiable !== (draft.price?.negotiable ?? false) ? { negotiable } : {}),
      };
      const { data } = await save({ variables: { id: draft.id, input } });
      const updated = data?.adminUpdateDraftDetails;
      // The API judges the text the same way it will at publish; keep the
      // dialog open while it still falls short, saying why.
      const remaining = (updated?.issues ?? [])
        .filter((issue) => issue.code === AdminDraftIssueCode.TITLE || issue.code === AdminDraftIssueCode.DESCRIPTION)
        .map((issue) => issue.message);
      setTextProblems(remaining);
      if (remaining.length === 0) {
        toast.success("Saved");
        onDone();
      }
    } catch (err) {
      onDone();
      onError(describeError(err));
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit details</DialogTitle>
        <DialogDescription>
          Saved to {displayName(draft.creator)}’s draft. Their location, phone and {mediaNoun(draft)} stay theirs.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`title-${draft.id}`}>Title</Label>
          <Input id={`title-${draft.id}`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={`caption-${draft.id}`}>Description</Label>
            <span className="text-xs tabular-nums text-muted">{caption.trim().length} / 2000</span>
          </div>
          <Textarea
            id={`caption-${draft.id}`}
            value={caption}
            maxLength={2000}
            rows={5}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={`price-${draft.id}`}>Price ({draft.price?.currency ?? "KES"})</Label>
            <Input
              id={`price-${draft.id}`}
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0 shows as “Contact for price”"
            />
          </div>
          <label className="flex h-9 cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={negotiable}
              onChange={(e) => setNegotiable(e.target.checked)}
              className="size-4 cursor-pointer accent-primary"
            />
            Negotiable
          </label>
        </div>
        {priceInvalid && <p className="text-xs text-error">Enter a price of 0 or more.</p>}
        {textProblems.length > 0 && (
          <div className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-secondary-strong">
            Saved, but it still can’t be published:
            <ul className="mt-1 space-y-0.5">
              {textProblems.map((problem) => (
                <li key={problem}>• {problem}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          {textProblems.length > 0 ? "Close" : "Cancel"}
        </Button>
        <Button onClick={() => void handleSave()} loading={loading} disabled={priceInvalid}>
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

function ActionMenuItems({ actions }: { actions: DraftAction[] }) {
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

/** The actions cell of a draft row: everything under "⋯". */
export function DraftRowActions({ draft }: { draft: AdminDraft }) {
  const { actions, dialogs, busy } = useDraftActions(draft);
  return (
    // Rows open the draft on click/Enter; actions inside them must not.
    <div
      className="flex items-center justify-end"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="More actions" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <ActionMenuItems actions={actions} />
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </div>
  );
}

/** The panel's action bar: the main fixes as buttons, the rest under "More". */
export function DraftActionBar({ draft, className }: { draft: AdminDraft; className?: string }) {
  const { actions, dialogs, busy } = useDraftActions(draft);
  const primaryKeys: ActionKey[] = ["publish", "retry", "removeBroken", "edit"];
  const primary = actions.filter((action) => primaryKeys.includes(action.key));
  const rest = actions.filter((action) => !primaryKeys.includes(action.key));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {primary.map(({ key, label, icon: Icon, onSelect, loading }) => (
        <Button
          key={key}
          size="sm"
          variant={key === "publish" ? "default" : "outline"}
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
