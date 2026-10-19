"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { toast } from "sonner";
import { uploadTeamMediaAsset } from "@/lib/team/upload-team-media";
import { ChevronLeft, Filter, MessageSquarePlus, Paperclip, Play, Send, X } from "lucide-react";
import {
  ADMIN_MARK_TEAM_THREAD_READ,
  ADMIN_REPLY_TEAM_THREAD,
  ADMIN_TEAM_BROADCASTS,
  ADMIN_TEAM_THREADS,
  ADMIN_TEAM_THREAD_MESSAGES,
  NOTIFY_IMAGE_UPLOADED,
  NOTIFY_VIDEO_UPLOADED,
  REQUEST_IMAGE_UPLOAD,
  REQUEST_VIDEO_UPLOAD,
} from "@/graphql/operations";
import {
  TeamBroadcastAudience,
  TeamMessageSender,
  type TeamBroadcast,
  type TeamMessage,
  type TeamThread,
} from "@/graphql/types";
import { displayName, formatDate, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  WS_EVENTS,
  type TeamMessageCreatedPayload,
  type TeamThreadUpdatedPayload,
} from "@/lib/socket/socket-events";
import { useSocket } from "@/hooks/useSocket";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { ComposeTeamMessageDialog } from "@/components/team/compose-team-message-dialog";
import { CountTabs, PageHeader, SearchInput } from "@/components/shared/page";

type View = "replies" | "threads" | "sent";

// No polling: every list below refetches on the API's `team:thread:updated`
// push, and <TeamInboxSync /> catches up after a dropped socket.
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const AUDIENCE_LABEL: Record<TeamBroadcastAudience, string> = {
  [TeamBroadcastAudience.SELECTED]: "Selected",
  [TeamBroadcastAudience.ALL_CREATORS]: "All creators",
  [TeamBroadcastAudience.ACTIVE_CREATORS]: "Live creators",
};

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

function TeamImageAttachment({ asset }: { asset: NonNullable<TeamMessage["mediaAsset"]> }) {
  const imageUrl =
    asset.r2Variants?.find((variant) => variant.variant === "medium")?.url ||
    asset.r2Variants?.find((variant) => Boolean(variant.url))?.url ||
    asset.thumbnailUrl ||
    null;
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    const label = asset.status === "FAILED" || failed ? "Image unavailable" : "Preparing image…";
    return <div role="status" aria-live="polite" className="flex h-full items-center justify-center px-4 text-xs text-muted">{label}</div>;
  }

  return (
    <a href={imageUrl} target="_blank" rel="noreferrer" className="block h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Message attachment"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
        loading="eager"
        decoding="async"
      />
    </a>
  );
}

function ThreadPanel({ thread, onChanged, onBack }: { thread: TeamThread; onChanged: () => void; onBack: () => void }) {
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const replyInput = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const name = displayName(thread.user);
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
  const activeRef = useRef(true);

  const { data, loading, refetch } = useQuery(ADMIN_TEAM_THREAD_MESSAGES, {
    variables: { userId: thread.userId, limit: 100 },
    fetchPolicy: "cache-and-network",
  });
  const [markRead] = useMutation(ADMIN_MARK_TEAM_THREAD_READ);
  const [sendReply, { loading: sending }] = useMutation(ADMIN_REPLY_TEAM_THREAD);
  const [requestImageUpload] = useMutation(REQUEST_IMAGE_UPLOAD);
  const [requestVideoUpload] = useMutation(REQUEST_VIDEO_UPLOAD);
  const [notifyImageUploaded] = useMutation(NOTIFY_IMAGE_UPLOADED);
  const [notifyVideoUploaded] = useMutation(NOTIFY_VIDEO_UPLOADED);
  const { on } = useSocket();

  const messages = useMemo(() => data?.adminTeamThreadMessages.items ?? [], [data]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  // Installed mobile PWAs can keep the layout viewport behind the keyboard.
  // Use the visible viewport so the composer stays above the keyboard.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateHeight = () => setVisualViewportHeight(viewport.height);
    updateHeight();
    viewport.addEventListener("resize", updateHeight);
    viewport.addEventListener("scroll", updateHeight);
    window.addEventListener("resize", updateHeight);
    return () => {
      viewport.removeEventListener("resize", updateHeight);
      viewport.removeEventListener("scroll", updateHeight);
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  function selectAttachment(nextFile: File | null) {
    setFile(nextFile);
    setFilePreview(nextFile?.type.startsWith("image/") ? URL.createObjectURL(nextFile) : null);
  }

  useLayoutEffect(() => {
    const input = replyInput.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    input.style.overflowY = input.scrollHeight > 160 ? "auto" : "hidden";
  }, [reply]);

  useLayoutEffect(() => {
    const panel = messagesRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [messages.length]);

  // New messages either way, or the member reading ours ("Seen"). The team
  // marking the member's replies read changes nothing shown here.
  useEffect(
    () =>
      on<TeamThreadUpdatedPayload>(WS_EVENTS.TEAM_THREAD_UPDATED, ({ reason, userId }) => {
        if (userId === thread.userId && reason !== "read" && reason !== "member_reply") void refetch();
      }),
    [on, refetch, thread.userId],
  );

  // Refresh the open conversation directly from the message event. This does
  // not wait for the inbox-wide unread count query used by the badge event.
  useEffect(
    () =>
      on<TeamMessageCreatedPayload>(WS_EVENTS.TEAM_MESSAGE_CREATED, ({ userId }) => {
        if (userId === thread.userId) void refetch();
      }),
    [on, refetch, thread.userId],
  );

  // Opening a thread with unread replies marks them read for the whole team.
  useEffect(() => {
    if (thread.teamUnreadCount === 0) return;
    void markRead({ variables: { userId: thread.userId } }).then(onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.userId, thread.teamUnreadCount]);

  async function refreshImageUntilReady(mediaAssetId: string) {
    for (let attempt = 0; attempt < 30 && activeRef.current; attempt += 1) {
      try {
        const result = await refetch();
        const asset = result.data?.adminTeamThreadMessages.items.find(
          (message) => message.mediaAssetId === mediaAssetId,
        )?.mediaAsset;
        if (asset?.status === "READY" || asset?.status === "FAILED") return;
      } catch {
        // Retry briefly through transient query failures while processing runs.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
  }

  async function handleReply() {
    if (!reply.trim() && !file) return;
    try {
      let mediaAssetId: string | null = null;
      let imageAssetId: string | null = null;
      setUploading(Boolean(file));
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
        if (!isVideo) imageAssetId = session.mediaAssetId;
      }
      await sendReply({ variables: { userId: thread.userId, body: reply.trim(), mediaAssetId } });
      setReply("");
      selectAttachment(null);
      await refetch();
      if (imageAssetId) void refreshImageUntilReady(imageAssetId);
      onChanged();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card
      className="fixed inset-x-0 top-14 z-50 flex h-[calc(var(--team-admin-viewport-height,100dvh)-3.5rem)] min-h-0 flex-col rounded-none lg:static lg:h-[calc(100svh-18rem)] lg:rounded-xl"
      style={visualViewportHeight ? { "--team-admin-viewport-height": `${visualViewportHeight}px` } as React.CSSProperties : undefined}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-3 sm:px-5 sm:py-4">
        <button type="button" onClick={onBack} className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-subtle lg:hidden" aria-label="Back to threads">
          <ChevronLeft className="size-5" />
        </button>
        <Avatar src={thread.user?.profile?.avatar} name={name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted">
            {thread.user?.email ?? (thread.user?.username ? `@${thread.user.username}` : thread.userId)}
          </p>
        </div>
        {thread.user?.isSuspended && (
          <Badge variant="destructive" className="ml-auto">
            Suspended
          </Badge>
        )}
      </div>

      <div ref={messagesRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
        {loading && messages.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-16 w-2/3", i % 2 ? "ml-auto" : "")} />
          ))
        ) : (
          messages.map((message) => {
            const fromTeam = message.sender === TeamMessageSender.TEAM;
            return (
              <div key={message.id} className={cn("flex", fromTeam ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "relative w-fit min-w-24 max-w-[88%] rounded-2xl px-4 py-2.5 text-sm md:w-[75%] md:max-w-none",
                    fromTeam ? "bg-primary text-on-brand" : "bg-subtle text-foreground",
                  )}
                >
                  {message.subject && <p className="mb-1 font-semibold">{message.subject}</p>}
                  {message.body && (message.body !== "Attachment" || !message.mediaAsset) && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                  {message.mediaAsset && (
                    <div className="mt-2 h-[35svh] min-h-[180px] max-h-[420px] min-w-[180px] overflow-hidden rounded-xl bg-black/5">
                      {message.mediaAsset.type === "VIDEO" ? message.mediaAsset.muxMeta?.playbackId ? (
                        <video controls preload="metadata" className="h-full w-full object-contain" poster={message.mediaAsset.muxMeta.thumbnailUrl ?? undefined} src={`https://stream.mux.com/${message.mediaAsset.muxMeta.playbackId}/high.mp4`} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted">Processing video…</div>
                      ) : (
                        <TeamImageAttachment
                          key={`${message.mediaAsset.status ?? ""}:${message.mediaAsset.thumbnailUrl ?? message.mediaAsset.r2Variants?.[0]?.url ?? ""}`}
                          asset={message.mediaAsset}
                        />
                      )}
                    </div>
                  )}
                  <p
                    className={cn(
                      "mt-1 text-[11px]",
                      fromTeam ? "text-on-brand/75" : "text-muted",
                    )}
                    title={formatDate(message.createdAt)}
                  >
                    {fromTeam ? "Shopi team" : name} · {formatRelative(message.createdAt)}
                    {fromTeam && message.readAt ? " · Seen" : ""}
                    {fromTeam && message.broadcastId ? " · broadcast" : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => { selectAttachment(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} />
        {file && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-elevated px-3 py-2">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-black/5">
              {filePreview && file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={filePreview} alt="Attachment preview" className="h-full w-full object-contain" />
              ) : null}
              {file.type.startsWith("video/") ? <div className="absolute inset-0 flex items-center justify-center bg-black/35"><Play className="size-4 text-white" fill="currentColor" /></div> : null}
            </div>
            <span className="flex-1 truncate text-xs text-muted">{file.type.startsWith("video/") ? "Video" : "Photo"} ready to send</span>
            <button type="button" aria-label="Remove attachment" onClick={() => selectAttachment(null)} className="flex size-7 items-center justify-center rounded-full bg-black/10 dark:bg-white/10"><X className="size-3.5" /></button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Attach photo or video" onClick={() => fileInput.current?.click()} disabled={sending || uploading}>
            <Paperclip />
          </Button>
          <textarea
            ref={replyInput}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleReply();
            }}
            placeholder={`Reply to ${name} as Shopi team…`}
            rows={1}
            maxLength={4000}
            className="min-h-[42px] max-h-40 flex-1 resize-none overflow-y-auto rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
            style={{ maxHeight: 160 }}
          />
          <Button
            size="icon"
            className="sm:size-auto sm:px-4"
            onClick={() => void handleReply()}
            loading={sending || uploading}
            disabled={!reply.trim() && !file}
            aria-label={sending || uploading ? "Sending reply" : "Send reply"}
            title="Send reply"
          >
            {!sending && !uploading && <Send />}
            <span className="hidden sm:inline">
              {sending || uploading ? "Sending..." : "Send"}
            </span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SentTable({ onViewReplies }: { onViewReplies: (broadcast: TeamBroadcast) => void }) {
  const [page, setPage] = useState(1);
  const { data, loading, refetch } = useQuery(ADMIN_TEAM_BROADCASTS, {
    variables: { page, limit: PAGE_SIZE },
    fetchPolicy: "cache-and-network",
  });
  const { on } = useSocket();
  const broadcasts = data?.adminTeamBroadcasts.data ?? [];
  const meta = data?.adminTeamBroadcasts.meta;

  // Reply counts move when a member replies; a new broadcast adds a row.
  useEffect(
    () =>
      on<TeamThreadUpdatedPayload>(WS_EVENTS.TEAM_THREAD_UPDATED, ({ reason }) => {
        if (reason === "broadcast") void refetch();
      }),
    [on, refetch],
  );

  useEffect(
    () =>
      on<TeamMessageCreatedPayload>(WS_EVENTS.TEAM_MESSAGE_CREATED, () => {
        void refetch();
      }),
    [on, refetch],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          {loading && broadcasts.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : broadcasts.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No messages sent yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Message</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Replied</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((broadcast) => {
                  const rate = broadcast.recipientCount
                    ? Math.round((broadcast.respondentCount / broadcast.recipientCount) * 100)
                    : 0;
                  return (
                    <TableRow key={broadcast.id}>
                      <TableCell>
                        <div className="max-w-[360px]">
                          {broadcast.subject && (
                            <p className="truncate text-sm font-medium text-foreground">
                              {broadcast.subject}
                            </p>
                          )}
                          <p className="truncate text-xs text-muted">
                            {broadcast.body || (broadcast.mediaAssetId ? "Attachment" : "")}
                            {broadcast.mediaAssetId ? " · attachment" : ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{AUDIENCE_LABEL[broadcast.audience]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatNumber(broadcast.recipientCount)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatNumber(broadcast.respondentCount)}
                        <span className="ml-1 text-xs text-muted">({rate}%)</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted" title={formatDate(broadcast.createdAt)}>
                        {formatRelative(broadcast.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={broadcast.respondentCount === 0}
                          onClick={() => onViewReplies(broadcast)}
                        >
                          View replies
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {meta && (
        <div className="sticky bottom-0 z-20 border-t border-border bg-elevated/95 px-4 pb-1 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

export default function TeamMessagesPage() {
  const [view, setView] = useState<View>("replies");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [broadcastFilter, setBroadcastFilter] = useState<TeamBroadcast | null>(null);
  // Snapshot, not just an id: in the unread view a thread drops out of the list
  // as soon as it's marked read, and the open panel must survive that.
  const [selectedThread, setSelectedThread] = useState<TeamThread | null>(null);
  const selectedUserId = selectedThread?.userId ?? null;
  const [composeOpen, setComposeOpen] = useState(false);

  const { data, loading, refetch } = useQuery(ADMIN_TEAM_THREADS, {
    variables: {
      page,
      limit: PAGE_SIZE,
      unreadOnly: view === "replies" && !broadcastFilter ? true : null,
      broadcastId: broadcastFilter?.id ?? null,
      search: submittedSearch || null,
    },
    skip: view === "sent",
    fetchPolicy: "cache-and-network",
  });
  const { on } = useSocket();

  // A member reading the team's messages is the only change that leaves the
  // thread list as it was.
  useEffect(
    () =>
      on<TeamThreadUpdatedPayload>(WS_EVENTS.TEAM_THREAD_UPDATED, ({ reason }) => {
        if (view !== "sent" && reason !== "member_read" && reason !== "member_reply") void refetch();
      }),
    [on, refetch, view],
  );

  useEffect(
    () =>
      on<TeamMessageCreatedPayload>(WS_EVENTS.TEAM_MESSAGE_CREATED, () => {
        if (view !== "sent") void refetch();
      }),
    [on, refetch, view],
  );

  const threads = useMemo(() => data?.adminTeamThreads.data ?? [], [data]);
  const meta = data?.adminTeamThreads.meta;
  const unreadThreads = data?.adminTeamThreads.unreadThreads ?? 0;
  const selected = threads.find((t) => t.userId === selectedUserId) ?? selectedThread;

  useEffect(() => {
    const next = search.trim();
    const handle = window.setTimeout(() => {
      setSubmittedSearch((current) => {
        if (current === next) return current;
        setPage(1);
        return next;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [search]);

  function switchView(next: View) {
    setView(next);
    setPage(1);
    setBroadcastFilter(null);
  }

  const tabs: { key: View; label: string; badge?: number }[] = [
    { key: "replies", label: "Unread replies", badge: unreadThreads },
    { key: "threads", label: "All threads" },
    { key: "sent", label: "Sent" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shopi team"
        description="Messages between Shopi and sellers — replies, threads and broadcasts."
        actions={
          <Button onClick={() => setComposeOpen(true)}>
            <MessageSquarePlus />
            New message
          </Button>
        }
      />

      <div className="flex flex-col gap-3 border-b border-border lg:flex-row lg:items-end lg:justify-between">
        <CountTabs
          tabs={tabs.map(({ key, label, badge }) => ({
            key,
            label,
            count: key === "replies" ? (badge ?? 0) : undefined,
            attention: key === "replies",
          }))}
          value={view}
          onChange={switchView}
        />
        {view !== "sent" && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Name, email or @handle"
            className="mb-2.5"
          />
        )}
      </div>

      {view === "sent" ? (
        <SentTable
          onViewReplies={(broadcast) => {
            setView("threads");
            setPage(1);
            setBroadcastFilter(broadcast);
            setSelectedThread(null);
          }}
        />
      ) : (
        <>
          {broadcastFilter && (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-elevated px-4 py-2.5 text-sm">
              <Filter className="size-4 text-muted" />
              <span className="min-w-0 truncate">
                Replies to <strong>{broadcastFilter.subject || broadcastFilter.body.slice(0, 60)}</strong>
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto size-7"
                onClick={() => setBroadcastFilter(null)}
                aria-label="Clear filter"
              >
                <X />
              </Button>
            </div>
          )}

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
            <div className={cn("min-w-0 space-y-3", selected && "hidden lg:block")}>
              <Card>
                <CardContent className="p-0">
                  {loading && threads.length === 0 ? (
                    <div className="space-y-2 p-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : threads.length === 0 ? (
                    <p className="px-6 py-16 text-center text-sm text-muted">
                      {view === "replies" && !broadcastFilter
                        ? "No unread replies — all caught up"
                        : "No threads yet. Send a message to start one."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {threads.map((thread) => {
                        const name = displayName(thread.user);
                        const active = thread.userId === selectedUserId;
                        return (
                          <li key={thread.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedThread(thread)}
                              className={cn(
                                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer",
                                active ? "bg-primary-soft" : "hover:bg-subtle",
                              )}
                            >
                              <Avatar src={thread.user?.profile?.avatar} name={name} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p
                                    className={cn(
                                      "truncate text-sm text-foreground",
                                      thread.teamUnreadCount > 0 && "font-semibold",
                                    )}
                                  >
                                    {name}
                                  </p>
                                  <span className="shrink-0 text-xs text-muted">
                                    {formatRelative(thread.lastMessageAt)}
                                  </span>
                                </div>
                                <p className="truncate text-xs text-muted">
                                  {thread.lastMessageSender === TeamMessageSender.TEAM ? "You: " : ""}
                                  {thread.lastMessagePreview}
                                </p>
                              </div>
                              {thread.teamUnreadCount > 0 && (
                                <span className="mt-1 rounded-full bg-primary px-1.5 text-xs font-bold text-on-brand">
                                  {thread.teamUnreadCount}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
              {meta && meta.totalPages > 1 && (
                <div className="sticky bottom-0 z-20 border-t border-border bg-elevated/95 px-4 pb-1 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                  <Pagination meta={meta} onPageChange={setPage} />
                </div>
              )}
            </div>

            {selected ? (
              <ThreadPanel key={selected.userId} thread={selected} onChanged={() => void refetch()} onBack={() => setSelectedThread(null)} />
            ) : (
              <Card className="hidden min-h-[480px] items-center justify-center lg:flex">
                <p className="text-sm text-muted">Select a thread to read and reply</p>
              </Card>
            )}
          </div>
        </>
      )}

      <ComposeTeamMessageDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSent={() => {
          if (view !== "sent") void refetch();
        }}
      />
    </div>
  );
}
