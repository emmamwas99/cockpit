"use client";

import { useApolloClient, useQuery } from "@apollo/client/react";
import { useEffect } from "react";
import { ADMIN_PENDING_REVIEW_COUNT } from "@/graphql/operations";
import { useSocket } from "@/hooks/useSocket";
import { WS_EVENTS } from "@/lib/socket/socket-events";

/** How often the Posts badge rechecks for newly submitted posts. */
const POLL_MS = 60_000;

/**
 * Posts waiting for approval, for the Posts nav badge and the Pending tab.
 * Reads the cache that <PendingReviewSync /> keeps fresh, so the sidebar,
 * mobile nav and posts page share one poll.
 */
export function usePendingReviewCount(): number {
  const { data } = useQuery(ADMIN_PENDING_REVIEW_COUNT, { fetchPolicy: "cache-first" });
  return data?.adminPendingReviewCount ?? 0;
}

/**
 * Keeps the pending-review count current across the dashboard. Mounted once in
 * the dashboard layout. Post submissions and moderation actions push a socket
 * event; polling remains as a catch-up if an event is missed while disconnected.
 */
export function PendingReviewSync() {
  const client = useApolloClient();
  const { on, onReconnect } = useSocket();

  useQuery(ADMIN_PENDING_REVIEW_COUNT, {
    pollInterval: POLL_MS,
    skipPollAttempt: () => document.hidden,
  });

  useEffect(
    () =>
      on(WS_EVENTS.ADMIN_PENDING_REVIEW_UPDATED, () => {
        void client.refetchQueries({ include: [ADMIN_PENDING_REVIEW_COUNT] });
      }),
    [on, client],
  );

  useEffect(
    () =>
      onReconnect(() => {
        void client.refetchQueries({ include: [ADMIN_PENDING_REVIEW_COUNT] });
      }),
    [onReconnect, client],
  );
  return null;
}
