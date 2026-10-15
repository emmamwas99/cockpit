"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client/react";
import { ChevronDown, LogOut, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { LOGOUT } from "@/graphql/operations";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { displayName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Brand } from "@/components/layout/sidebar";

export function Topbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [logout] = useMutation(LOGOUT);

  async function handleLogout() {
    try {
      if (refreshToken) await logout({ variables: { refreshToken } });
    } catch {
      // Best-effort server-side revoke; local sign-out always proceeds.
    } finally {
      clearAuth();
      toast.success("Signed out");
      router.replace("/login");
    }
  }

  const name = displayName(user);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-elevated/95 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <MobileNav />
        <Brand />
      </div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Avatar src={user?.profile?.avatar} name={name} className="size-7" />
              <span className="hidden max-w-36 truncate text-sm font-medium text-foreground sm:block">
                {name}
              </span>
              <ChevronDown className="size-4 text-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              {user?.email && <p className="truncate text-xs text-muted">{user.email}</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void handleLogout()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
