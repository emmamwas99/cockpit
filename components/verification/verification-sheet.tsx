"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useQuery } from "@apollo/client/react";
import dayjs from "dayjs";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  Minus,
  MoreHorizontal,
  Phone,
  RotateCcw,
  Send,
  ShieldOff,
  Store,
  Undo2,
  XCircle,
} from "lucide-react";
import { ADMIN_SHOP_VERIFICATION } from "@/graphql/operations";
import {
  ShopVerificationEventType,
  ShopVerificationStatus,
  type AdminContent,
  type AdminShopVerification,
  type AdminVerificationEvent,
  type ShopVerificationDocument,
} from "@/graphql/types";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { webUrl } from "@/lib/web-url";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CountTabs, EmptyState } from "@/components/shared/page";
import { SellerPosts } from "@/components/posts/seller-posts";
import { PostDetail } from "@/components/posts/post-detail";
import { ComposeTeamMessageDialog } from "@/components/team/compose-team-message-dialog";
import {
  DocumentLightbox,
  VerificationStatusBadge,
  VerifiedTick,
  fileSize,
  ordinal,
  placeLine,
} from "./verification-ui";
import {
  ApproveVerificationDialog,
  GrantVerificationDialog,
  RequestChangesDialog,
  RevokeVerificationDialog,
  type VerificationSubject,
} from "./verification-dialogs";

type SheetTab = "review" | "posts" | "history";
type DialogKind = "approve" | "changes" | "revoke" | "grant" | "message";
type Tone = "good" | "warn" | "neutral";

/** A permit with no expiry left is a reason to ask for the current one. */
function permitExpired(value?: string | null): boolean {
  return Boolean(value && dayjs(value).isBefore(dayjs()));
}

/** Editing software is worth a second look on a "real" shop photo; a phone's own firmware isn't. */
const EDITOR_PATTERN = /photoshop|lightroom|snapseed|canva|picsart|gimp|pixlr|facetune|remini|instagram|whatsapp/i;

function mapsLink(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

const TILE = 256;
const MAP_ZOOM = 16;

/**
 * The shop pin on a map, built from standard OpenStreetMap tiles: a 5×3 grid
 * of plain images shifted so the pin sits dead centre. No key, no WebGL (the
 * OSM embed now needs it, and plenty of admin machines don't have it), and it
 * costs a handful of cached tile requests. Clicking opens Google Maps.
 */
function StaticMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const scale = TILE * 2 ** MAP_ZOOM;
  const x = ((longitude + 180) / 360) * scale;
  const sin = Math.sin((latitude * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  const tileX = Math.floor(x / TILE);
  const tileY = Math.floor(y / TILE);
  const firstX = tileX - 2;
  const firstY = tileY - 1;
  const max = 2 ** MAP_ZOOM;

  const tiles: { key: string; src: string; left: number; top: number }[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const tx = (((firstX + col) % max) + max) % max;
      const ty = firstY + row;
      if (ty < 0 || ty >= max) continue;
      tiles.push({
        key: `${tx}-${ty}`,
        src: `https://tile.openstreetmap.org/${MAP_ZOOM}/${tx}/${ty}.png`,
        left: col * TILE,
        top: row * TILE,
      });
    }
  }

  return (
    <a
      href={mapsLink(latitude, longitude)}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block h-48 overflow-hidden border-t border-border bg-subtle"
      aria-label="Open the shop location in Google Maps"
    >
      <div
        className="absolute"
        style={{
          width: TILE * 5,
          height: TILE * 3,
          left: `calc(50% - ${x - firstX * TILE}px)`,
          top: `calc(50% - ${y - firstY * TILE}px)`,
        }}
      >
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.src}
            alt=""
            width={TILE}
            height={TILE}
            loading="lazy"
            className="absolute max-w-none select-none"
            style={{ left: tile.left, top: tile.top }}
            draggable={false}
          />
        ))}
      </div>
      <MapPin
        className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-full fill-primary text-white drop-shadow"
        strokeWidth={1.5}
        aria-hidden
      />
      <span className="absolute bottom-1 right-1 rounded bg-white/85 px-1 text-[10px] text-neutral-600">
        © OpenStreetMap contributors
      </span>
    </a>
  );
}

function phoneHref(phone: string): string {
  return `tel:+${phone.replace(/\D/g, "")}`;
}

/** "254712345678" → "0712 345 678" — the way a Kenyan reads a number. */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("254") ? `0${digits.slice(3)}` : digits;
  return local.length === 10 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : phone;
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function CheckRow({ tone, label, value, hint }: { tone: Tone; label: string; value: React.ReactNode; hint?: string }) {
  const Icon = tone === "good" ? Check : tone === "warn" ? AlertTriangle : Minus;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
          tone === "good" && "bg-success-soft text-success",
          tone === "warn" && "bg-warning-soft text-secondary-strong",
          tone === "neutral" && "bg-subtle text-muted",
        )}
      >
        <Icon className="size-3" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

function DocumentCard({
  title,
  document,
  guidance,
  onOpen,
}: {
  title: string;
  document?: ShopVerificationDocument | null;
  guidance: string;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {document && (
          <Button variant="ghost" size="sm" className="-mr-1.5 h-7 px-2" onClick={onOpen}>
            Open
          </Button>
        )}
      </div>
      {document ? (
        <button
          type="button"
          onClick={onOpen}
          className="group relative block aspect-[4/3] w-full overflow-hidden bg-subtle"
          aria-label={`Open ${title.toLowerCase()}`}
        >
          {document.isPdf || failed || !document.url ? (
            <span className="flex size-full flex-col items-center justify-center gap-2 text-muted">
              <FileText className="size-8" strokeWidth={1.5} />
              <span className="text-xs">{document.isPdf ? "PDF — open to read" : "Preview unavailable"}</span>
            </span>
          ) : (
            <img
              src={document.url}
              alt={title}
              className="size-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              onError={() => setFailed(true)}
            />
          )}
        </button>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-subtle px-6 text-center text-xs text-muted">
          Not uploaded yet
        </div>
      )}
      <div className="space-y-0.5 px-3 py-2">
        {document && (
          <p className="truncate text-xs text-muted" title={document.fileName ?? undefined}>
            {[document.fileName, fileSize(document.sizeBytes), `uploaded ${formatRelative(document.uploadedAt)}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <p className="text-xs text-muted">{guidance}</p>
      </div>
    </div>
  );
}

function Notice({ tone, icon: Icon, children }: { tone: "info" | "good" | "warn" | "muted"; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13px]",
        tone === "info" && "bg-primary-soft text-foreground",
        tone === "good" && "bg-success-soft text-foreground",
        tone === "warn" && "bg-warning-soft text-foreground",
        tone === "muted" && "bg-subtle text-foreground",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  );
}

const EVENT_LABEL: Record<ShopVerificationEventType, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  [ShopVerificationEventType.SUBMITTED]: { label: "Submitted for review", icon: Send, tone: "text-primary-strong bg-primary-soft" },
  [ShopVerificationEventType.WITHDRAWN]: { label: "Withdrawn to edit", icon: Undo2, tone: "text-muted bg-subtle" },
  [ShopVerificationEventType.APPROVED]: { label: "Verified", icon: BadgeCheck, tone: "text-success bg-success-soft" },
  [ShopVerificationEventType.GRANTED]: { label: "Verified without documents", icon: BadgeCheck, tone: "text-success bg-success-soft" },
  [ShopVerificationEventType.REJECTED]: { label: "Sent back for changes", icon: RotateCcw, tone: "text-secondary-strong bg-warning-soft" },
  [ShopVerificationEventType.REVOKED]: { label: "Verification removed", icon: ShieldOff, tone: "text-error bg-error-soft" },
};

function HistoryItem({ event }: { event: AdminVerificationEvent }) {
  const style = EVENT_LABEL[event.type] ?? { label: event.type, icon: Minus, tone: "text-muted bg-subtle" };
  const Icon = style.icon;
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full", style.tone)}>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm text-foreground">
          <span className="font-medium">{style.label}</span>
          {event.actorName && <span className="text-muted"> · {event.actorName}</span>}
        </p>
        <p className="text-xs text-muted" title={formatDate(event.at)}>
          {formatRelative(event.at)}
        </p>
        {event.issues.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {event.issues.map((issue) => (
              <Badge key={issue.issue} variant="warning">
                {issue.title}
              </Badge>
            ))}
          </div>
        )}
        {event.note && <p className="mt-1.5 text-[13px] text-foreground">&ldquo;{event.note}&rdquo;</p>}
        {event.internalNote && (
          <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
            <Lock className="mt-0.5 size-3 shrink-0" /> {event.internalNote}
          </p>
        )}
      </div>
    </li>
  );
}

// ── Review tab ───────────────────────────────────────────────────────────────

function Review({
  detail,
  onOpenDocument,
  onMessage,
  onGrant,
}: {
  detail: AdminShopVerification;
  onOpenDocument: (document: ShopVerificationDocument, title: string) => void;
  onMessage: () => void;
  onGrant: () => void;
}) {
  const application = detail.application;
  const applicant = detail.applicant;

  if (!application) {
    return (
      <EmptyState
        icon={Store}
        title="No application yet"
        description="This seller hasn't started shop verification. Invite them with a message, or verify them without documents if the team has checked the shop another way."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={onMessage}>
              <Megaphone /> Message seller
            </Button>
            {!applicant?.isVerified && (
              <Button variant="ghost" size="sm" onClick={onGrant}>
                Verify without documents
              </Button>
            )}
          </div>
        }
      />
    );
  }

  const location = application.location;
  const photo = detail.photoCheck;
  const places = detail.listingPlaces ?? [];
  const pin =
    typeof location?.latitude === "number" && typeof location?.longitude === "number"
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;
  const topListingCounty = places.find((place) => place.county)?.county;

  return (
    <div className="space-y-6">
      {/* Where it stands, in one line, before anything else. */}
      {application.status === ShopVerificationStatus.REJECTED && (
        <Notice tone="warn" icon={RotateCcw}>
          <p className="font-medium">Waiting for the seller&rsquo;s changes</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {application.issues.map((issue) => (
              <li key={issue.issue}>{issue.title}</li>
            ))}
          </ul>
          {application.decisionNote && <p className="text-muted">&ldquo;{application.decisionNote}&rdquo;</p>}
        </Notice>
      )}
      {application.status === ShopVerificationStatus.APPROVED && (
        <Notice tone="good" icon={BadgeCheck}>
          <p>
            <span className="font-medium">Verified {formatRelative(application.verifiedAt)}</span>
            {detail.reviewerName && <span className="text-muted"> by {detail.reviewerName}</span>}
            {detail.grantedManually && <span className="text-muted"> · without documents</span>}
          </p>
          {detail.permitExpiresAt && (
            <p className={cn(permitExpired(detail.permitExpiresAt) ? "font-medium text-error" : "text-muted")}>
              {permitExpired(detail.permitExpiresAt)
                ? `Permit expired ${dayjs(detail.permitExpiresAt).format("D MMM YYYY")} — ask for the current one`
                : `Permit valid until ${dayjs(detail.permitExpiresAt).format("D MMM YYYY")}`}
            </p>
          )}
        </Notice>
      )}
      {application.status === ShopVerificationStatus.REVOKED && (
        <Notice tone="muted" icon={ShieldOff}>
          <p className="font-medium">Verification removed {formatRelative(application.revokedAt)}</p>
          {application.decisionNote && <p className="text-muted">&ldquo;{application.decisionNote}&rdquo;</p>}
        </Notice>
      )}
      {application.status === ShopVerificationStatus.DRAFT && (
        <Notice tone="muted" icon={Clock3}>
          <p className="font-medium">Started {formatRelative(application.createdAt)}, not submitted yet</p>
          {application.missing.length > 0 && (
            <p className="text-muted">
              Still missing:{" "}
              {application.missing
                .map((item) => ({ BUSINESS_NAME: "business name", PERMIT: "permit", SHOP_PHOTO: "shop photo", LOCATION: "location" })[item])
                .join(", ")}
            </p>
          )}
        </Notice>
      )}

      <Section title="Checks">
        <div className="divide-y divide-border rounded-xl border border-border px-3">
          <CheckRow
            tone="neutral"
            label="Business name"
            value={application.businessName || "Not given"}
            hint="Should match the name printed on the permit."
          />
          {photo ? (
            <CheckRow
              tone={photo.hasCameraDetails ? "good" : "warn"}
              label="Shop photo"
              value={
                photo.hasCameraDetails
                  ? [`Taken on ${photo.camera}`, photo.takenAt ? dayjs(photo.takenAt).format("D MMM YYYY") : null]
                      .filter(Boolean)
                      .join(" · ")
                  : "No camera details in the file"
              }
              hint={
                photo.hasCameraDetails
                  ? photo.software && EDITOR_PATTERN.test(photo.software)
                    ? `Passed through ${photo.software} — check it hasn't been edited.`
                    : undefined
                  : "Could be a screenshot or a saved picture — or just a browser that strips details. Look closely."
              }
            />
          ) : (
            <CheckRow tone="neutral" label="Shop photo" value="Not uploaded" />
          )}
          {photo?.hasLocation && typeof photo.distanceFromPinKm === "number" ? (
            <CheckRow
              tone={photo.distanceFromPinKm <= 1 ? "good" : photo.distanceFromPinKm > 5 ? "warn" : "neutral"}
              label="Where the photo was taken"
              value={
                photo.distanceFromPinKm < 0.1
                  ? "At the shop pin"
                  : `${photo.distanceFromPinKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km from the shop pin`
              }
            />
          ) : (
            <CheckRow
              tone="neutral"
              label="Where the photo was taken"
              value={photo?.hasLocation ? "Photo has a location, but the shop has no pin" : "No location in the photo"}
            />
          )}
          <CheckRow
            tone={detail.listingCountyMatches === true ? "good" : detail.listingCountyMatches === false ? "warn" : "neutral"}
            label="Listings"
            value={
              places.length === 0
                ? "No live listings yet"
                : detail.listingCountyMatches === false
                  ? `Most are in ${topListingCounty} — the shop is in ${location?.county ?? "another county"}`
                  : `Most are in ${topListingCounty ?? places[0].label}${detail.listingCountyMatches ? ", same county as the shop" : ""}`
            }
          />
        </div>
      </Section>

      <Section title="Documents">
        <div className="grid gap-3 sm:grid-cols-2">
          <DocumentCard
            title="Business permit"
            document={application.permit}
            guidance="Check the business name, the dates and the issuing county."
            onOpen={() => application.permit && onOpenDocument(application.permit, "Business permit")}
          />
          <DocumentCard
            title="Shop photo"
            document={application.shopPhoto}
            guidance="A real storefront, stall or premises — not a logo or product shot."
            onOpen={() => application.shopPhoto && onOpenDocument(application.shopPhoto, "Shop photo")}
          />
        </div>
      </Section>

      <Section
        title="Location"
        action={
          pin ? (
            <a
              href={mapsLink(pin.latitude, pin.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open in Google Maps <ExternalLink className="size-3" />
            </a>
          ) : undefined
        }
      >
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-start gap-2.5 px-3 py-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
            <div className="min-w-0 text-sm">
              <p className="text-foreground">{placeLine(location) || "No area given"}</p>
              {location?.addressLine && <p className="text-foreground">{location.addressLine}</p>}
              <p className="text-xs text-muted">
                {[location?.wardName && `${location.wardName} ward`, location?.formattedAddress].filter(Boolean).join(" · ") ||
                  (pin ? "" : "No map pin — check the address line")}
              </p>
            </div>
          </div>
          {pin && <StaticMap latitude={pin.latitude} longitude={pin.longitude} />}
        </div>
        {places.length > 0 && (
          <div className="rounded-xl border border-border px-3 py-1.5">
            <p className="py-1 text-xs text-muted">Where they list from</p>
            <ul className="divide-y divide-border">
              {places.map((place) => (
                <li key={place.label} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="truncate text-foreground">{place.label}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {formatNumber(place.count)} listing{place.count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {applicant && (
        <Section title="Seller">
          <dl className="divide-y divide-border rounded-xl border border-border px-3 text-sm">
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-muted">Live listings</dt>
              <dd className="tabular-nums text-foreground">{formatNumber(applicant.liveListingCount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <dt className="text-muted">On Shopi since</dt>
              <dd className="text-foreground">{dayjs(applicant.memberSince).format("D MMM YYYY")}</dd>
            </div>
            {applicant.contactPhone && (
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-muted">Phone</dt>
                <dd>
                  <a href={phoneHref(applicant.contactPhone)} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                    <Phone className="size-3.5" /> {formatPhone(applicant.contactPhone)}
                  </a>
                </dd>
              </div>
            )}
            {applicant.email && (
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-muted">Email</dt>
                <dd className="min-w-0 truncate">
                  <a href={`mailto:${applicant.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                    <Mail className="size-3.5 shrink-0" /> <span className="truncate">{applicant.email}</span>
                  </a>
                </dd>
              </div>
            )}
          </dl>
          {detail.internalNote && (
            <p className="flex items-start gap-1.5 rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
              <Lock className="mt-0.5 size-3 shrink-0" /> {detail.internalNote}
            </p>
          )}
        </Section>
      )}
    </div>
  );
}

// ── The sheet ────────────────────────────────────────────────────────────────

/**
 * One seller's shop verification, start to finish: the documents, the checks
 * that make a decision quick, their listings, the history, and every decision.
 * Opens for any seller — from the queue, or from Users for someone who never
 * applied.
 */
export function VerificationSheet({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<SheetTab>("review");
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [lightbox, setLightbox] = useState<{ document: ShopVerificationDocument; title: string } | null>(null);
  const [post, setPost] = useState<AdminContent | null>(null);

  const { data, loading, error } = useQuery(ADMIN_SHOP_VERIFICATION, {
    variables: { userId: userId ?? "" },
    skip: !userId || !open,
    fetchPolicy: "cache-and-network",
  });
  // A stale copy from another seller must never show under this one's name.
  const detail = data?.adminShopVerification.userId === userId ? data?.adminShopVerification : undefined;
  const application = detail?.application;
  const applicant = detail?.applicant;
  const status = application?.status;
  const sellerName = applicant?.displayName ?? "This seller";
  const businessName = application?.businessName || sellerName;
  const subject: VerificationSubject | null = userId ? { userId, businessName, sellerName } : null;
  const historyCount = detail?.events?.length ?? 0;
  const documentsComplete = Boolean(application && application.missing.length === 0);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setTab("review");
      setPost(null);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="sm:max-w-2xl">
          {!detail ? (
            <>
              <SheetHeader>
                <SheetTitle>{error ? "Couldn't load this seller" : "Loading…"}</SheetTitle>
                <SheetDescription>{error ? error.message : "Fetching the application and its documents."}</SheetDescription>
              </SheetHeader>
              {!error && (
                <SheetBody className="space-y-3">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Skeleton className="aspect-[4/3] rounded-xl" />
                    <Skeleton className="aspect-[4/3] rounded-xl" />
                  </div>
                  <Skeleton className="h-40 w-full rounded-xl" />
                </SheetBody>
              )}
              {loading && <span className="sr-only">Loading</span>}
            </>
          ) : (
            <>
              <SheetHeader className="space-y-3 pb-0">
                <div className="flex items-start gap-3">
                  <Avatar src={applicant?.avatar} name={sellerName} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="flex items-center gap-1.5">
                      <span className="truncate">{businessName}</span>
                      {applicant?.isVerified && <VerifiedTick />}
                    </SheetTitle>
                    <SheetDescription className="truncate">
                      {[
                        application?.businessName ? sellerName : null,
                        applicant?.username ? `@${applicant.username}` : null,
                        applicant ? `on Shopi since ${dayjs(applicant.memberSince).format("MMM YYYY")}` : "Account deleted",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </SheetDescription>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {status ? <VerificationStatusBadge status={status} /> : <Badge variant="outline">Not applied</Badge>}
                      {application && application.submissionCount > 1 && (
                        <Badge variant="secondary">{ordinal(application.submissionCount)} submission</Badge>
                      )}
                      {application?.submittedAt && status === ShopVerificationStatus.PENDING && (
                        <span className="text-xs text-muted" title={formatDate(application.submittedAt)}>
                          Submitted {formatRelative(application.submittedAt)}
                        </span>
                      )}
                      {applicant?.isSuspended && <Badge variant="destructive">Suspended</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pr-8">
                    {applicant && (
                      <Button size="sm" variant="outline" onClick={() => setDialog("message")}>
                        <Megaphone /> Message
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label="More actions">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {applicant?.username && (
                          <DropdownMenuItem asChild>
                            <a href={webUrl(`/en/@${applicant.username}`)} target="_blank" rel="noopener noreferrer">
                              <ExternalLink /> Open storefront
                            </a>
                          </DropdownMenuItem>
                        )}
                        {applicant?.email && (
                          <DropdownMenuItem asChild>
                            <a href={`mailto:${applicant.email}`}>
                              <Mail /> Email seller
                            </a>
                          </DropdownMenuItem>
                        )}
                        {(applicant?.isVerified || status === ShopVerificationStatus.APPROVED) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onSelect={() => setDialog("revoke")}>
                              <ShieldOff /> Remove verification
                            </DropdownMenuItem>
                          </>
                        )}
                        {!applicant?.isVerified && status !== ShopVerificationStatus.APPROVED && applicant && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setDialog("grant")}>
                              <BadgeCheck /> Verify without documents
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CountTabs
                  tabs={[
                    { key: "review" as const, label: "Review" },
                    { key: "posts" as const, label: "Listings", count: applicant?.liveListingCount },
                    { key: "history" as const, label: "History", count: historyCount },
                  ]}
                  value={tab}
                  onChange={(next) => {
                    setPost(null);
                    setTab(next);
                  }}
                  className="-mx-3"
                />
              </SheetHeader>

              <SheetBody>
                {tab === "posts" ? (
                  post ? (
                    <div className="space-y-4">
                      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setPost(null)}>
                        <ArrowLeft /> All listings
                      </Button>
                      <p className="text-base font-semibold text-foreground">{post.title}</p>
                      <PostDetail post={post} />
                    </div>
                  ) : (
                    <SellerPosts creatorId={detail.userId} onOpenPost={setPost} />
                  )
                ) : tab === "history" ? (
                  historyCount === 0 ? (
                    <EmptyState icon={Clock3} title="Nothing yet" description="Submissions and decisions will show here." />
                  ) : (
                    <ol className="relative before:absolute before:bottom-3 before:left-3.5 before:top-3 before:w-px before:bg-border">
                      {detail.events!.map((event, index) => (
                        <HistoryItem key={`${event.type}-${event.at}-${index}`} event={event} />
                      ))}
                    </ol>
                  )
                ) : (
                  <Review
                    detail={detail}
                    onOpenDocument={(document, title) => setLightbox({ document, title })}
                    onMessage={() => setDialog("message")}
                    onGrant={() => setDialog("grant")}
                  />
                )}
              </SheetBody>

              {/* Decisions live in one place, always within reach. */}
              {status === ShopVerificationStatus.PENDING && (
                <SheetFooter className="justify-end">
                  <p className="mr-auto hidden text-xs text-muted sm:block">The seller hears about either decision straight away.</p>
                  <Button variant="outline" onClick={() => setDialog("changes")}>
                    <XCircle /> Request changes
                  </Button>
                  <Button variant="success" onClick={() => setDialog("approve")}>
                    <BadgeCheck /> Verify shop
                  </Button>
                </SheetFooter>
              )}
              {(status === ShopVerificationStatus.REJECTED || status === ShopVerificationStatus.REVOKED) && documentsComplete && (
                <SheetFooter className="justify-end">
                  <p className="mr-auto text-xs text-muted">
                    {status === ShopVerificationStatus.REJECTED
                      ? "Waiting for the seller to resubmit."
                      : "The seller can apply again."}
                  </p>
                  <Button variant="outline" onClick={() => setDialog("approve")}>
                    <BadgeCheck /> {status === ShopVerificationStatus.REJECTED ? "Verify anyway" : "Restore verification"}
                  </Button>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <DocumentLightbox
        document={lightbox?.document ?? null}
        title={lightbox?.title ?? ""}
        open={Boolean(lightbox)}
        onOpenChange={(next) => !next && setLightbox(null)}
      />
      <ApproveVerificationDialog subject={subject} open={dialog === "approve"} onOpenChange={(next) => !next && setDialog(null)} />
      <RequestChangesDialog subject={subject} open={dialog === "changes"} onOpenChange={(next) => !next && setDialog(null)} />
      <RevokeVerificationDialog subject={subject} open={dialog === "revoke"} onOpenChange={(next) => !next && setDialog(null)} />
      <GrantVerificationDialog subject={subject} open={dialog === "grant"} onOpenChange={(next) => !next && setDialog(null)} />
      <ComposeTeamMessageDialog
        open={dialog === "message"}
        onOpenChange={(next) => !next && setDialog(null)}
        recipient={applicant ? { id: applicant.id, name: sellerName } : null}
      />
    </>
  );
}
