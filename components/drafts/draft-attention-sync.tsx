"use client";

import { useEffect } from "react";
import { useApolloClient, useQuery } from "@apollo/client/react";
import { ADMIN_DRAFT_COUNTS, ADMIN_DRAFTS } from "@/graphql/operations";
import { useSocket } from "@/hooks/useSocket";
import { WS_EVENTS } from "@/lib/socket/socket-events";

/** The count of drafts needing attention, shared by the Drafts view. */
export function useDraftAttentionCount(): number {
  const { data } = useQuery(ADMIN_DRAFT_COUNTS, { fetchPolicy: "cache-first" });
  return data?.adminDraftCounts.attention ?? 0;
}

/** Keeps draft counts and an open Drafts page current from API events. */
export function DraftAttentionSync() {
  const client = useApolloClient();
  const { on, onReconnect } = useSocket();
  useQuery(ADMIN_DRAFT_COUNTS);

  useEffect(() => {
    const refresh = () => {
      void client.refetchQueries({ include: [ADMIN_DRAFT_COUNTS, ADMIN_DRAFTS] });
    };
    const offUpdate = on(WS_EVENTS.ADMIN_DRAFTS_UPDATED, refresh);
    const offReconnect = onReconnect(refresh);
    return () => {
      offUpdate();
      offReconnect();
    };
  }, [client, on, onReconnect]);

  return null;
}
