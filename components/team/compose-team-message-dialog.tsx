"use client";

import { useRef, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import { uploadTeamMediaAsset } from "@/lib/team/upload-team-media";
import { Paperclip, Send, X } from "lucide-react";
import { ADMIN_SEND_TEAM_MESSAGE, NOTIFY_IMAGE_UPLOADED, NOTIFY_VIDEO_UPLOADED, REQUEST_IMAGE_UPLOAD, REQUEST_VIDEO_UPLOAD } from "@/graphql/operations";
import { TeamBroadcastAudience } from "@/graphql/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_BODY = 4000;

const AUDIENCE_OPTIONS = [
  {
    value: TeamBroadcastAudience.ACTIVE_CREATORS,
    label: "Creators with a live post",
    hint: "Sellers who currently have at least one live listing.",
  },
  {
    value: TeamBroadcastAudience.ALL_CREATORS,
    label: "All creators",
    hint: "Everyone who has ever posted, including sellers with nothing live.",
  },
];

export interface TeamRecipient {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Send to exactly this member instead of a broadcast audience. */
  recipient?: TeamRecipient | null;
  onSent?: () => void;
}

/**
 * Compose a message members receive from "Shopi team" — a survey link, a
 * performance check-in, an announcement. Members can reply in their thread.
 */
export function ComposeTeamMessageDialog({ open, onOpenChange, recipient, onSent }: Props) {
  const [audience, setAudience] = useState(TeamBroadcastAudience.ACTIVE_CREATORS);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [send, { loading }] = useMutation(ADMIN_SEND_TEAM_MESSAGE, {
    refetchQueries: ["AdminTeamBroadcasts", "AdminTeamThreads"],
  });
  const [requestImageUpload] = useMutation(REQUEST_IMAGE_UPLOAD);
  const [requestVideoUpload] = useMutation(REQUEST_VIDEO_UPLOAD);
  const [notifyImageUploaded] = useMutation(NOTIFY_IMAGE_UPLOADED);
  const [notifyVideoUploaded] = useMutation(NOTIFY_VIDEO_UPLOADED);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSubject("");
      setBody("");
      setFile(null);
    }
    onOpenChange(next);
  }

  const audienceHint = AUDIENCE_OPTIONS.find((o) => o.value === audience)?.hint;

  async function handleSend() {
    if (!body.trim() && !file) {
      toast.error("Write a message or attach a photo or video first");
      return;
    }
    setUploading(Boolean(file));
    try {
      let mediaAssetId: string | null = null;
      if (file) {
        const isVideo = file.type.startsWith("video/");
        const session = isVideo
          ? (await requestVideoUpload({ variables: { corsOrigin: window.location.origin } })).data?.requestVideoUpload
          : (await requestImageUpload({ variables: { mimeType: file.type || "image/jpeg" } })).data?.requestImageUpload;
        if (!session?.mediaAssetId) throw new Error("Could not start the upload");
        await uploadTeamMediaAsset(file, session.mediaAssetId, isVideo);
        if (isVideo) await notifyVideoUploaded({ variables: { mediaAssetId: session.mediaAssetId } });
        else await notifyImageUploaded({ variables: { mediaAssetId: session.mediaAssetId } });
        mediaAssetId = session.mediaAssetId;
      }
      const { data } = await send({
        variables: {
          input: recipient
            ? {
                audience: TeamBroadcastAudience.SELECTED,
                userIds: [recipient.id],
                subject: subject.trim() || null,
                body: body.trim(),
                mediaAssetId,
              }
            : { audience, subject: subject.trim() || null, body: body.trim(), mediaAssetId },
        },
      });
      const count = data?.adminSendTeamMessage.recipientCount ?? 0;
      toast.success(
        recipient
          ? `Sent to ${recipient.name}`
          : `Sent to ${count} member${count === 1 ? "" : "s"}`,
      );
      handleOpenChange(false);
      onSent?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{recipient ? `Message ${recipient.name}` : "New Shopi team message"}</DialogTitle>
          <DialogDescription>
            Delivered to their inbox from <strong>Shopi team</strong> with a notification. They can
            reply, and replies show up on the Shopi team page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!recipient && (
            <div className="space-y-1.5">
              <Label htmlFor="team-audience">Send to</Label>
              <Select
                id="team-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value as TeamBroadcastAudience)}
              >
                {AUDIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {audienceHint && <p className="text-xs text-muted">{audienceHint}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="team-subject">Subject (optional)</Label>
            <Input
              id="team-subject"
              value={subject}
              maxLength={160}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. 2-minute seller survey"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-body">Message</Label>
            <Textarea
              id="team-body"
              value={body}
              maxLength={MAX_BODY}
              rows={7}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                "Hi! How has selling on Shopi been this month?\n\nTell us in 2 minutes: https://forms.gle/…"
              }
            />
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading || loading}>
                <Paperclip /> Attach photo or video
              </Button>
              {file && (
                <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
                  <span className="truncate">{file.name}</span>
                  <button type="button" aria-label="Remove attachment" onClick={() => setFile(null)}><X className="size-3.5" /></button>
                </span>
              )}
            </div>
            <p className="text-right text-xs text-muted">
              {body.length}/{MAX_BODY}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSend()} loading={loading || uploading} disabled={!body.trim() && !file}>
            {!loading && <Send />}
            {loading ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
