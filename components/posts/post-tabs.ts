import { ContentStatus, type AdminContentCounts } from "@/graphql/types";

export type PostTabKey =
  | "pending"
  | "all"
  | "live"
  | "reported"
  | "processing"
  | "hidden"
  | "rejected"
  | "removed"
  | "failed";

export interface PostTab {
  key: PostTabKey;
  label: string;
  status?: ContentStatus;
  reported?: boolean;
  countKey: keyof AdminContentCounts;
  /** Work waiting: its count stays highlighted when the tab isn't selected. */
  attention?: boolean;
}

/** The status queues for posts — the old Moderation page lives here now. */
export const POST_TABS: PostTab[] = [
  { key: "pending", label: "Pending review", status: ContentStatus.PENDING_REVIEW, countKey: "pendingReview", attention: true },
  { key: "all", label: "All", countKey: "all" },
  { key: "live", label: "Live", status: ContentStatus.ACTIVE, countKey: "active" },
  { key: "reported", label: "Reported", reported: true, countKey: "reported", attention: true },
  { key: "processing", label: "Processing", status: ContentStatus.PROCESSING, countKey: "processing" },
  { key: "hidden", label: "Hidden", status: ContentStatus.UNDER_REVIEW, countKey: "underReview" },
  { key: "rejected", label: "Rejected", status: ContentStatus.REJECTED, countKey: "rejected" },
  { key: "removed", label: "Removed", status: ContentStatus.REMOVED, countKey: "removed" },
  { key: "failed", label: "Failed", status: ContentStatus.FAILED, countKey: "failed", attention: true },
];

export function postTab(key: string | null | undefined): PostTab | undefined {
  return POST_TABS.find((tab) => tab.key === key);
}
