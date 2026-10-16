"use client";

import { useQuery } from "@apollo/client/react";
import { ADMIN_DRAFT_COUNTS } from "@/graphql/operations";

const POLL_MS = 60_000;

/** The count of drafts needing attention, shared by the Drafts tab and nav badge. */
export function useDraftAttentionCount(): number {
  const { data } = useQuery(ADMIN_DRAFT_COUNTS, { fetchPolicy: "cache-first" });
  return data?.adminDraftCounts.attention ?? 0;
}

/** Keeps the sidebar count fresh while the dashboard is open. */
export function DraftAttentionSync() {
  useQuery(ADMIN_DRAFT_COUNTS, {
    pollInterval: POLL_MS,
    skipPollAttempt: () => document.hidden,
  });
  return null;
}
