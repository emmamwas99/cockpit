"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import {
  ADMIN_APPROVE_SHOP_VERIFICATION,
  ADMIN_GRANT_SHOP_VERIFICATION,
  ADMIN_REJECT_SHOP_VERIFICATION,
  ADMIN_REVOKE_SHOP_VERIFICATION,
} from "@/graphql/operations";
import { ShopVerificationIssue } from "@/graphql/types";
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
import { ISSUE_GROUPS, VERIFICATION_REFETCH } from "./verification-ui";

const NOTE_MAX = 500;
const INTERNAL_MAX = 1000;

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

/** Who the decision is about, as the dialogs name them. */
export interface VerificationSubject {
  userId: string;
  businessName: string;
  sellerName: string;
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const optional = <span className="font-normal text-muted">Optional</span>;

// ── Approve ──────────────────────────────────────────────────────────────────

export function ApproveVerificationDialog({
  subject,
  open,
  onOpenChange,
}: {
  subject: VerificationSubject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [approve, { loading }] = useMutation(ADMIN_APPROVE_SHOP_VERIFICATION, {
    refetchQueries: VERIFICATION_REFETCH,
  });

  function reset() {
    setValidUntil("");
    setNote("");
    setInternalNote("");
  }

  async function handleConfirm() {
    if (!subject) return;
    try {
      await approve({
        variables: {
          userId: subject.userId,
          input: {
            // End of the day the permit names, so it is valid through that date.
            permitExpiresAt: validUntil ? new Date(`${validUntil}T23:59:59+03:00`).toISOString() : null,
            note: note.trim() || null,
            internalNote: internalNote.trim() || null,
          },
        },
      });
      toast.success(`${subject.businessName} is verified`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify {subject?.businessName}?</DialogTitle>
          <DialogDescription>
            {subject?.sellerName}{" "}
            gets the blue tick on their profile and Verified ID on every listing. We&rsquo;ll let them know in
            the app, by push and by email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field id="permit-valid-until" label={<>Permit valid until {optional}</>} hint="As printed on the permit. Kept for the team.">
            <Input
              id="permit-valid-until"
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              className="w-48"
            />
          </Field>
          <Field id="approve-note" label={<>Message to the seller {optional}</>}>
            <Textarea
              id="approve-note"
              rows={2}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Welcome aboard — your permit is good until December."
            />
          </Field>
          <Field id="approve-internal" label={<>Internal note {optional}</>} hint="Only the team sees this.">
            <Textarea
              id="approve-internal"
              rows={2}
              maxLength={INTERNAL_MAX}
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleConfirm} loading={loading}>
            Verify shop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Request changes ──────────────────────────────────────────────────────────

export function RequestChangesDialog({
  subject,
  open,
  onOpenChange,
}: {
  subject: VerificationSubject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [issues, setIssues] = useState<ShopVerificationIssue[]>([]);
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [reject, { loading }] = useMutation(ADMIN_REJECT_SHOP_VERIFICATION, {
    refetchQueries: VERIFICATION_REFETCH,
  });

  const onlyOther = issues.length === 1 && issues[0] === ShopVerificationIssue.OTHER;
  const needsNote = onlyOther && !note.trim();
  const canSend = issues.length > 0 && !needsNote;

  function reset() {
    setIssues([]);
    setNote("");
    setInternalNote("");
  }

  function toggle(issue: ShopVerificationIssue) {
    setIssues((current) =>
      current.includes(issue) ? current.filter((value) => value !== issue) : [...current, issue],
    );
  }

  async function handleConfirm() {
    if (!subject || !canSend) return;
    try {
      await reject({
        variables: {
          userId: subject.userId,
          input: {
            issues,
            note: note.trim() || null,
            internalNote: internalNote.trim() || null,
          },
        },
      });
      toast.success(`Sent back to ${subject.sellerName}`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request changes</DialogTitle>
          <DialogDescription>
            Tell {subject?.sellerName} what to fix. Everything else they sent is kept, so they only redo what you
            tick.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3">
          <legend className="sr-only">What needs fixing</legend>
          {ISSUE_GROUPS.map(({ group, items }) => (
            <div key={group}>
              <p className="mb-1 text-xs font-medium text-muted">{group}</p>
              <div className="space-y-0.5">
                {items.map(({ issue, label }) => {
                  const checked = issues.includes(issue);
                  return (
                    <label
                      key={issue}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-subtle",
                        checked && "bg-primary-soft/60",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(issue)}
                        className="size-4 shrink-0 accent-[rgb(var(--brand-primary))]"
                      />
                      <span className="text-foreground">{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>

        <div className="space-y-4">
          <Field
            id="reject-note"
            label={onlyOther ? "Message to the seller" : <>Message to the seller {optional}</>}
            hint="Shown with the reasons above, in the app and by email."
          >
            <Textarea
              id="reject-note"
              rows={3}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Your permit photo is cut off at the bottom — please include the dates."
              aria-invalid={needsNote}
            />
          </Field>
          <Field id="reject-internal" label={<>Internal note {optional}</>} hint="Only the team sees this.">
            <Textarea
              id="reject-internal"
              rows={2}
              maxLength={INTERNAL_MAX}
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={loading} disabled={!canSend}>
            Send to seller
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Revoke ───────────────────────────────────────────────────────────────────

export function RevokeVerificationDialog({
  subject,
  open,
  onOpenChange,
}: {
  subject: VerificationSubject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [revoke, { loading }] = useMutation(ADMIN_REVOKE_SHOP_VERIFICATION, {
    refetchQueries: VERIFICATION_REFETCH,
  });

  function reset() {
    setReason("");
    setInternalNote("");
  }

  async function handleConfirm() {
    if (!subject || !reason.trim()) return;
    try {
      await revoke({
        variables: {
          userId: subject.userId,
          input: { reason: reason.trim(), internalNote: internalNote.trim() || null },
        },
      });
      toast.success(`Verification removed from ${subject.businessName}`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove verification from {subject?.businessName}?</DialogTitle>
          <DialogDescription>
            The blue tick and the Verified ID badges come off straight away, and we tell {subject?.sellerName} why.
            Their listings stay up, and they can apply again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field id="revoke-reason" label="Reason" hint="The seller reads this, in the app and by email.">
            <Textarea
              id="revoke-reason"
              rows={3}
              maxLength={NOTE_MAX}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Your shop has closed, so we can no longer verify it."
            />
          </Field>
          <Field id="revoke-internal" label={<>Internal note {optional}</>} hint="Only the team sees this.">
            <Textarea
              id="revoke-internal"
              rows={2}
              maxLength={INTERNAL_MAX}
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} loading={loading} disabled={!reason.trim()}>
            Remove verification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Verify without documents ─────────────────────────────────────────────────

export function GrantVerificationDialog({
  subject,
  open,
  onOpenChange,
}: {
  subject: VerificationSubject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [internalNote, setInternalNote] = useState("");
  const [note, setNote] = useState("");
  const [grant, { loading }] = useMutation(ADMIN_GRANT_SHOP_VERIFICATION, {
    refetchQueries: VERIFICATION_REFETCH,
  });

  function reset() {
    setInternalNote("");
    setNote("");
  }

  async function handleConfirm() {
    if (!subject || !internalNote.trim()) return;
    try {
      await grant({
        variables: {
          userId: subject.userId,
          input: { internalNote: internalNote.trim(), note: note.trim() || null },
        },
      });
      toast.success(`${subject.businessName} is verified`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify without documents</DialogTitle>
          <DialogDescription>
            Only for a shop the team has checked another way — a visit, a call with the owner, a known brand.{" "}
            {subject?.sellerName} gets the blue tick straight away.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field id="grant-internal" label="How you verified it" hint="Required. Only the team sees this.">
            <Textarea
              id="grant-internal"
              rows={3}
              maxLength={INTERNAL_MAX}
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="e.g. Visited the shop at Bazaar Plaza on 12 Oct and saw the permit."
            />
          </Field>
          <Field id="grant-note" label={<>Message to the seller {optional}</>}>
            <Textarea
              id="grant-note"
              rows={2}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleConfirm} loading={loading} disabled={!internalNote.trim()}>
            Verify shop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
