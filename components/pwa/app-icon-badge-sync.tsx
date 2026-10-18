"use client";

import { useEffect } from "react";
import { useQuery } from "@apollo/client/react";
import {
  ADMIN_PENDING_REVIEW_COUNT,
  ADMIN_PENDING_SHOP_VERIFICATION_COUNT,
  ADMIN_TEAM_UNREAD_THREADS,
} from "@/graphql/operations";

/**
 * Mirrors the dashboard's live navigation counts onto the installed PWA icon.
 * The app badge API is only available in browsers that support installed app
 * badges; the regular in-app nav badges continue to work everywhere.
 */
export function AppIconBadgeSync() {
  const { data: reviews } = useQuery(ADMIN_PENDING_REVIEW_COUNT, { fetchPolicy: "cache-first" });
  const { data: verifications } = useQuery(ADMIN_PENDING_SHOP_VERIFICATION_COUNT, {
    fetchPolicy: "cache-first",
  });
  const { data: team } = useQuery(ADMIN_TEAM_UNREAD_THREADS, { fetchPolicy: "cache-first" });

  const isReady = reviews !== undefined && verifications !== undefined && team !== undefined;
  const total =
    (reviews?.adminPendingReviewCount ?? 0) +
    (verifications?.adminPendingShopVerificationCount ?? 0) +
    (team?.adminTeamUnreadThreads ?? 0);

  useEffect(() => {
    if (!isReady || typeof navigator === "undefined") return;

    const badge = navigator as Navigator & {
      setAppBadge?: (contents?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (total > 0 && badge.setAppBadge) {
      void badge.setAppBadge(total).catch(() => undefined);
    } else if (total === 0 && badge.clearAppBadge) {
      void badge.clearAppBadge().catch(() => undefined);
    }
  }, [isReady, total]);

  return null;
}
