import { AlertTriangle, CalendarClock, CircleX } from "lucide-react";
import {
  AdminDraftIssueCode,
  DraftMediaHealth,
  DraftStatus,
  type AdminDraft,
} from "@/graphql/types";
import { formatDate, formatRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

/** The noun the screen uses for a draft's media. */
export function mediaNoun(draft: Pick<AdminDraft, "type">, count = 2): string {
  const noun = draft.type === "VIDEO" ? "video" : "photo";
  return count === 1 ? noun : `${noun}s`;
}

/** A blocking issue in two or three words, for the list row. */
const ISSUE_LABELS: Record<AdminDraftIssueCode, string> = {
  [AdminDraftIssueCode.MEDIA_MISSING]: "No photos",
  [AdminDraftIssueCode.MEDIA_UNUSABLE]: "Media failed",
  [AdminDraftIssueCode.MEDIA_PENDING]: "Media uploading",
  [AdminDraftIssueCode.TITLE]: "Title too short",
  [AdminDraftIssueCode.DESCRIPTION]: "Description too short",
  [AdminDraftIssueCode.TYPE]: "No listing type",
  [AdminDraftIssueCode.LOCATION]: "No location",
  [AdminDraftIssueCode.PHONE]: "No phone number",
  [AdminDraftIssueCode.PRICE]: "Invalid price",
};

const STATUS_BADGES: Record<DraftStatus, { label: string; variant: "success" | "secondary" }> = {
  [DraftStatus.ACTIVE]: { label: "In progress", variant: "secondary" },
  [DraftStatus.PUBLISHED]: { label: "Published", variant: "success" },
  [DraftStatus.DISCARDED]: { label: "Discarded", variant: "secondary" },
  [DraftStatus.EXPIRED]: { label: "Expired", variant: "secondary" },
};

/** Where a draft stands, and the one thing most worth knowing about it. */
export function DraftStatusLine({ draft }: { draft: AdminDraft }) {
  if (draft.status !== DraftStatus.ACTIVE) {
    const style = STATUS_BADGES[draft.status];
    return <Badge variant={style.variant}>{style.label}</Badge>;
  }

  const blocking = draft.issues.filter((issue) => issue.blocking);
  const total = draft.media.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {draft.unusableMediaCount > 0 ? (
        <Badge variant="destructive">
          <CircleX />
          {draft.unusableMediaCount === total
            ? `All ${total} ${mediaNoun(draft, total)} failed`
            : `${draft.unusableMediaCount} of ${total} ${mediaNoun(draft, total)} failed`}
        </Badge>
      ) : draft.canPublish ? (
        <Badge variant="success">Ready to publish</Badge>
      ) : blocking[0] ? (
        <Badge variant="warning">{ISSUE_LABELS[blocking[0].code]}</Badge>
      ) : null}
      {blocking.length > 1 && draft.unusableMediaCount === 0 && (
        <span className="text-xs text-muted">+{blocking.length - 1} more</span>
      )}
      {draft.publishFailureCount > 0 && (
        <Badge variant="outline" title={draft.lastPublishError ?? undefined}>
          <AlertTriangle />
          Publish failed{draft.publishFailureCount > 1 ? ` ×${draft.publishFailureCount}` : ""}
        </Badge>
      )}
      {draft.scheduledPublishAt && (
        <Badge variant="accent" title={formatDate(draft.scheduledPublishAt)}>
          <CalendarClock /> {formatRelative(draft.scheduledPublishAt)}
        </Badge>
      )}
    </div>
  );
}

const HEALTH_STYLES: Record<
  DraftMediaHealth,
  { label: string; variant: "success" | "secondary" | "accent" | "destructive" | "warning" }
> = {
  [DraftMediaHealth.READY]: { label: "Ready", variant: "success" },
  [DraftMediaHealth.PROCESSING]: { label: "Processing", variant: "accent" },
  [DraftMediaHealth.UPLOADING]: { label: "Uploading", variant: "accent" },
  [DraftMediaHealth.NOT_UPLOADED]: { label: "Didn’t upload", variant: "destructive" },
  [DraftMediaHealth.FAILED]: { label: "Failed", variant: "destructive" },
  [DraftMediaHealth.MISSING]: { label: "Missing", variant: "destructive" },
};

export function MediaHealthBadge({ health }: { health: DraftMediaHealth }) {
  const style = HEALTH_STYLES[health];
  return <Badge variant={style.variant}>{style.label}</Badge>;
}

export function isBrokenMedia(health: DraftMediaHealth): boolean {
  return (
    health === DraftMediaHealth.NOT_UPLOADED ||
    health === DraftMediaHealth.FAILED ||
    health === DraftMediaHealth.MISSING
  );
}
