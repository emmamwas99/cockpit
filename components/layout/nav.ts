import {
  Activity,
  BadgeCheck,
  ChartLine,
  Clapperboard,
  FilePen,
  FolderTree,
  Gift,
  LayoutDashboard,
  MapPin,
  Megaphone,
  MessagesSquare,
  Rocket,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Live counts of work waiting: posts to review, shops to verify. */
  badge?: "pendingReview" | "pendingVerification" | "teamUnread";
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

/**
 * The admin's navigation, in one place for the sidebar and the mobile menu.
 *
 * Moderation lives in Posts (its queues are status tabs there), Creators in
 * Users (seller filter and actions), and Social proof is parked for now. Their
 * pages still exist; they are just not in the menu.
 */
export const NAV_SECTIONS: NavSection[] = [
  { items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Marketplace",
    items: [
      { href: "/posts", label: "Posts", icon: Clapperboard, badge: "pendingReview" },
      { href: "/drafts", label: "Drafts", icon: FilePen },
      { href: "/boosts", label: "Boosts", icon: Rocket },
      { href: "/categories", label: "Categories", icon: FolderTree },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/verification", label: "Verification", icon: BadgeCheck, badge: "pendingVerification" },
      { href: "/referrals", label: "Referrals", icon: Gift },
      { href: "/conversations", label: "Conversations", icon: MessagesSquare },
      { href: "/ratings", label: "App ratings", icon: Star },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/growth", label: "Growth", icon: ChartLine },
      { href: "/locations", label: "Locations", icon: MapPin },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/team", label: "Shopi team", icon: Megaphone, badge: "teamUnread" },
      { href: "/system", label: "System", icon: Activity },
    ],
  },
];

export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
