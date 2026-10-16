"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Clapperboard,
  ExternalLink,
  LogIn,
  Mail,
  Megaphone,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserRoundCheck,
} from "lucide-react";
import { ADMIN_CREATE_IMPERSONATION_TOKEN } from "@/graphql/operations";
import { UserRole, type AdminUser } from "@/graphql/types";
import { displayName } from "@/lib/format";
import { webUrl } from "@/lib/web-url";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComposeTeamMessageDialog } from "@/components/team/compose-team-message-dialog";
import { VerificationSheet } from "@/components/verification/verification-sheet";
import { DeleteUserDialog, RolesDialog, SuspendDialog } from "./user-dialogs";

export function rolesOf(user: Pick<AdminUser, "roles" | "role">): UserRole[] {
  return user.roles?.length ? user.roles : user.role ? [user.role] : [UserRole.USER];
}

export function isSeller(user: Pick<AdminUser, "roles" | "role">): boolean {
  return rolesOf(user).includes(UserRole.CREATOR);
}

type DialogKind = "roles" | "verification" | "suspend" | "delete" | "message";

export interface UserActionsApi {
  open: (kind: DialogKind, user: AdminUser) => void;
  impersonate: (user: AdminUser) => void;
  impersonatingId: string | null;
  /** Render once, anywhere on the page. */
  dialogs: React.ReactNode;
}

/**
 * Every account action on one page: the dialogs render once, and any menu or
 * panel opens them for whichever user it is about.
 */
export function useUserActions(): UserActionsApi {
  const [dialog, setDialog] = useState<{ kind: DialogKind; user: AdminUser } | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [createToken] = useMutation(ADMIN_CREATE_IMPERSONATION_TOKEN);

  async function impersonate(user: AdminUser) {
    setImpersonatingId(user.id);
    // Open the tab synchronously, inside the click, so it isn't blocked.
    const popup = window.open("about:blank", "_blank");
    try {
      const { data } = await createToken({ variables: { userId: user.id } });
      const token = data?.adminCreateImpersonationToken.token;
      if (!token) throw new Error("No sign-in link came back");
      const url = webUrl(`/en/auth/impersonate?token=${encodeURIComponent(token)}`);
      if (popup) {
        popup.opener = null;
        popup.location.replace(url);
      } else if (!window.open(url, "_blank", "noopener,noreferrer")) {
        throw new Error("Your browser blocked the new tab — allow pop-ups for this site");
      }
      toast.success(`Opened Shopi as ${displayName(user)}`);
    } catch (err) {
      if (popup && !popup.closed) popup.close();
      toast.error(err instanceof Error ? err.message : "Could not sign in as this user");
    } finally {
      setImpersonatingId(null);
    }
  }

  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };
  const user = dialog?.user ?? null;

  const dialogs = (
    <>
      <RolesDialog user={user} open={dialog?.kind === "roles"} onOpenChange={close} />
      {/* Verification is a review, not a switch: the same panel as the Verification
          queue, opened in place over this screen. */}
      <VerificationSheet
        userId={dialog?.kind === "verification" ? (user?.id ?? null) : null}
        open={dialog?.kind === "verification"}
        onOpenChange={close}
      />
      <SuspendDialog user={user} open={dialog?.kind === "suspend"} onOpenChange={close} />
      <DeleteUserDialog user={user} open={dialog?.kind === "delete"} onOpenChange={close} />
      <ComposeTeamMessageDialog
        open={dialog?.kind === "message"}
        onOpenChange={close}
        recipient={user ? { id: user.id, name: displayName(user) } : null}
      />
    </>
  );

  return {
    open: (kind, target) => setDialog({ kind, user: target }),
    impersonate: (target) => void impersonate(target),
    impersonatingId,
    dialogs,
  };
}

/** The "⋯" menu for one user. */
export function UserActionMenu({
  user,
  api,
  onViewPosts,
  align = "end",
}: {
  user: AdminUser;
  api: UserActionsApi;
  onViewPosts?: (user: AdminUser) => void;
  align?: "start" | "end";
}) {
  const me = useAuthStore((s) => s.user);
  const roles = rolesOf(user);
  const isAdmin = roles.includes(UserRole.ADMIN);
  const isMe = user.id === me?.id;
  const canImpersonate = !isMe && !isAdmin && !user.isSuspended;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Actions for ${displayName(user)}`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} onClick={(event) => event.stopPropagation()}>
        {isSeller(user) && onViewPosts && (
          <DropdownMenuItem onSelect={() => onViewPosts(user)}>
            <Clapperboard /> View posts
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => api.open("message", user)}>
          <Megaphone /> Message as Shopi team
        </DropdownMenuItem>
        {user.email && (
          <DropdownMenuItem asChild>
            <a href={`mailto:${user.email}`}>
              <Mail /> Email
            </a>
          </DropdownMenuItem>
        )}
        {user.username && (
          <DropdownMenuItem asChild>
            <a href={webUrl(`/en/@${user.username}`)} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Open storefront
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={!canImpersonate || api.impersonatingId === user.id}
          onSelect={() => api.impersonate(user)}
          title={
            isAdmin
              ? "Admin accounts can't be signed into"
              : user.isSuspended
                ? "Suspended accounts can't be signed into"
                : undefined
          }
        >
          <LogIn /> Sign in as this user
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => api.open("verification", user)}>
          <BadgeCheck /> Shop verification
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => api.open("roles", user)}>
          <ShieldCheck /> Change roles
        </DropdownMenuItem>
        {!isMe && (
          <DropdownMenuItem onSelect={() => api.open("suspend", user)}>
            {user.isSuspended ? <UserRoundCheck /> : <UserMinus />}
            {user.isSuspended ? "Reinstate" : "Suspend"}
          </DropdownMenuItem>
        )}
        {!isMe && !isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => api.open("delete", user)}>
              <Trash2 /> Delete user
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
