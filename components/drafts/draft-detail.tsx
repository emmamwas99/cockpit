"use client";

import { useFragment } from "@apollo/client/react";
import { AlertTriangle, CircleCheck, CircleX, Clock } from "lucide-react";
import { ADMIN_DRAFT_FIELDS } from "@/graphql/operations";
import {
  ContentCreationMethod,
  DraftStatus,
  DraftStep,
  type AdminDraft,
} from "@/graphql/types";
import { displayName, formatDate, formatPrice, formatRelative } from "@/lib/format";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Person } from "@/components/shared/page";
import { DraftActionBar } from "./draft-actions";
import { DraftMediaGallery, DraftMediaProblems } from "./draft-media";
import { DraftStatusLine } from "./draft-status";

/**
 * The draft as it is in the cache right now. Every draft action returns the
 * full draft, so after a retry or a publish the open panel updates in place.
 */
export function useLiveDraft(draft: AdminDraft): AdminDraft {
  const { complete, data } = useFragment({
    fragment: ADMIN_DRAFT_FIELDS,
    fragmentName: "AdminDraftFields",
    from: { __typename: "AdminDraft", id: draft.id },
  });
  if (!complete || !data) return draft;
  return data as unknown as AdminDraft;
}

const STEP_LABELS: Record<DraftStep, string> = {
  [DraftStep.MEDIA_UPLOAD]: "Adding photos",
  [DraftStep.EDITING]: "Writing details",
  [DraftStep.PUBLISHING_OPTIONS]: "Choosing options",
  [DraftStep.READY]: "Ready to post",
};

/** `254712345678` → `+254 712 345 678`. */
function formatPhone(phone?: string | null): string {
  if (!phone) return "—";
  return /^254\d{9}$/.test(phone)
    ? `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`
    : phone;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  );
}

/** What stands between the draft and a post, or that nothing does. */
function DraftReadiness({ draft }: { draft: AdminDraft }) {
  if (draft.status !== DraftStatus.ACTIVE) return null;
  if (draft.issues.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-[13px] text-success">
        <CircleCheck className="size-4 shrink-0" />
        Nothing is stopping this draft. It can be published as it is.
      </p>
    );
  }
  return (
    <section>
      <p className="mb-1.5 text-xs font-medium text-muted">What’s stopping it</p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {draft.issues.map((issue) => (
          <li key={issue.code} className="flex items-start gap-2.5 px-3 py-2.5 text-[13px]">
            {issue.blocking ? (
              <CircleX className="mt-px size-4 shrink-0 text-error" />
            ) : (
              <Clock className="mt-px size-4 shrink-0 text-muted" />
            )}
            <span className="text-foreground">{issue.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The error the seller got the last time they tried to post this. */
function LastPublishError({ draft }: { draft: AdminDraft }) {
  if (!draft.lastPublishError) return null;
  const times = draft.publishFailureCount;
  return (
    <section className="rounded-xl border border-error/20 bg-error-soft px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-error">
        <AlertTriangle className="size-3.5" />
        {draft.status === DraftStatus.ACTIVE ? "Last publish attempt failed" : "A publish attempt failed"}
        {times > 1 ? ` · ${times} times` : ""}
        {draft.lastPublishErrorAt && (
          <span className="font-normal" title={formatDate(draft.lastPublishErrorAt)}>
            · {formatRelative(draft.lastPublishErrorAt)}
          </span>
        )}
      </p>
      <p className="mt-1 text-[13px] text-foreground">“{draft.lastPublishError}”</p>
    </section>
  );
}

/** Everything about one draft and every action on it — the body of the draft panel. */
export function DraftDetail({ draft: initial }: { draft: AdminDraft }) {
  const draft = useLiveDraft(initial);
  const place = [draft.location?.placeName, draft.location?.subregion, draft.location?.county]
    .filter(Boolean)
    .join(", ");
  const category = [draft.categoryName, draft.subcategoryName].filter(Boolean).join(" › ");

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,13rem)_1fr]">
        <div className="mx-auto w-full max-w-[13rem]">
          <DraftMediaGallery key={draft.id} draft={draft} />
        </div>
        <div className="min-w-0 space-y-4">
          <DraftStatusLine draft={draft} />
          <div>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {draft.price ? formatPrice(draft.price) : "No price yet"}
            </p>
            {draft.price?.negotiable && <p className="text-xs text-muted">Negotiable</p>}
          </div>
          <DraftActionBar draft={draft} />
          <LastPublishError draft={draft} />
        </div>
      </div>

      <DraftReadiness draft={draft} />
      <DraftMediaProblems draft={draft} />

      <section className="rounded-xl border border-border p-3">
        <p className="mb-2 text-xs font-medium text-muted">Seller</p>
        <Person
          name={displayName(draft.creator)}
          avatar={draft.creator?.profile?.avatar}
          secondary={[draft.creator?.username && `@${draft.creator.username}`, draft.creator?.email]
            .filter(Boolean)
            .join(" · ")}
        />
      </section>

      {(draft.caption || draft.hashtags.length > 0) && (
        <section>
          <p className="mb-1.5 text-xs font-medium text-muted">Description</p>
          {draft.caption && <p className="whitespace-pre-wrap text-sm text-foreground">{draft.caption}</p>}
          {draft.hashtags.length > 0 && (
            <p className="mt-2 text-[13px] text-primary">{draft.hashtags.map((tag) => `#${tag}`).join(" ")}</p>
          )}
        </section>
      )}

      {draft.specs.length > 0 && (
        <section>
          <p className="mb-1.5 text-xs font-medium text-muted">Specifications</p>
          <dl className="divide-y divide-border rounded-xl border border-border px-3">
            {draft.specs.map((spec) => (
              <Detail key={spec.key} label={spec.key}>
                {spec.value}
              </Detail>
            ))}
          </dl>
        </section>
      )}

      <dl className="divide-y divide-border rounded-xl border border-border px-3">
        <Detail label="Step">{STEP_LABELS[draft.currentStep]}</Detail>
        <Detail label="Category">{category || "—"}</Detail>
        <Detail label="Location">{place || "—"}</Detail>
        <Detail label="Phone">
          <span className="tabular-nums">{formatPhone(draft.contactPhone)}</span>
        </Detail>
        <Detail label="Written by">
          {draft.creationMethod === ContentCreationMethod.AGENT ? "Shopi Agent" : "Seller (manual)"}
        </Detail>
        {(draft.isBulk || draft.isTiktokImport) && (
          <Detail label="Source">{draft.isBulk ? "Bulk upload" : "Imported from TikTok"}</Detail>
        )}
        {draft.scheduledPublishAt && <Detail label="Scheduled for">{formatDate(draft.scheduledPublishAt)}</Detail>}
        <Detail label="Started">
          <span title={formatDate(draft.createdAt)}>{formatRelative(draft.createdAt)}</span>
        </Detail>
        <Detail label="Last saved">
          <span title={formatDate(draft.updatedAt)}>{formatRelative(draft.updatedAt)}</span>
        </Detail>
        <Detail label="Draft ID">
          <span className="font-mono text-[12px]">{draft.id}</span>
        </Detail>
      </dl>
    </div>
  );
}

/** The draft panel on the drafts screen. */
export function DraftSheet({
  draft,
  open,
  onOpenChange,
}: {
  draft: AdminDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        {draft && (
          <>
            <SheetHeader>
              <SheetTitle className="truncate">{draft.title?.trim() || "Untitled draft"}</SheetTitle>
              <SheetDescription>
                {displayName(draft.creator)} · started {formatRelative(draft.createdAt)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <DraftDetail draft={draft} />
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
