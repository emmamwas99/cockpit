import { AdminDraftTab, type AdminDraftCounts } from "@/graphql/types";

export type DraftTabKey = "attention" | "active" | "scheduled" | "published" | "discarded";

export interface DraftTab {
  key: DraftTabKey;
  label: string;
  tab: AdminDraftTab;
  countKey: keyof AdminDraftCounts;
  /** Work waiting: its count stays highlighted when the tab isn't selected. */
  attention?: boolean;
}

export const DRAFT_TABS: DraftTab[] = [
  { key: "attention", label: "Needs attention", tab: AdminDraftTab.ATTENTION, countKey: "attention", attention: true },
  { key: "active", label: "In progress", tab: AdminDraftTab.ACTIVE, countKey: "active" },
  { key: "scheduled", label: "Scheduled", tab: AdminDraftTab.SCHEDULED, countKey: "scheduled" },
  { key: "published", label: "Published", tab: AdminDraftTab.PUBLISHED, countKey: "published" },
  { key: "discarded", label: "Discarded", tab: AdminDraftTab.DISCARDED, countKey: "discarded" },
];

export function draftTab(key: string | null | undefined): DraftTab | undefined {
  return DRAFT_TABS.find((tab) => tab.key === key);
}
