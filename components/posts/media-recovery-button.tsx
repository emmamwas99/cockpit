"use client";

import { useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { ADMIN_TRIGGER_MEDIA_RECOVERY } from "@/graphql/operations";
import { Button } from "@/components/ui/button";

/** Posts whose status may change once recovered media finishes processing. */
const REFETCH = [
  "AdminContent",
  "AdminContentCounts",
  "AdminDashboardStats",
  "AdminPendingReviewCount",
  "PendingApprovalContent",
];

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Finishes posts stuck on their media right now: the API asks Mux and R2
 * directly (a video Mux already encoded is applied, a lost Mux job is re-sent
 * from the R2 original, images are processed on the spot), so it works with
 * Redis down. When the queues are up it then re-queues older stuck uploads,
 * as the boot/cron sweep does. Safe to press repeatedly.
 */
export function MediaRecoveryButton() {
  const [trigger, { loading }] = useMutation(ADMIN_TRIGGER_MEDIA_RECOVERY, {
    refetchQueries: REFETCH,
  });

  async function handleTrigger() {
    try {
      const { data } = await trigger();
      const summary = data?.adminTriggerMediaRecovery;
      if (!summary) return;

      const queued = summary.imageJobs + summary.videoJobs + summary.tiktokJobs;
      const parts = [
        summary.finishedNow > 0 && `${summary.finishedNow} finished`,
        summary.stillEncoding > 0 && `${plural(summary.stillEncoding, "video")} still encoding at Mux`,
        summary.missingOriginals > 0 && `${summary.missingOriginals} with no original in storage`,
        summary.failedNow > 0 && `${summary.failedNow} couldn't be processed`,
        queued > 0 && `${queued} re-queued`,
        summary.replayed > 0 && `${plural(summary.replayed, "post")} reconciled`,
        !summary.queuesAvailable && "Redis is down, so the queue sweep was skipped",
      ].filter(Boolean);

      const didSomething =
        summary.finishedNow +
          summary.stillEncoding +
          summary.missingOriginals +
          summary.failedNow +
          queued +
          summary.replayed >
        0;
      if (!didSomething) {
        toast.success("Media recovery ran — nothing was stuck", {
          description: summary.queuesAvailable ? undefined : parts.join(" · "),
        });
        return;
      }

      const notify = summary.missingOriginals + summary.failedNow > 0 ? toast.warning : toast.success;
      notify("Media recovery finished", { description: parts.join(" · ") });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Media recovery failed");
    }
  }

  return (
    <Button
      variant="outline"
      onClick={() => void handleTrigger()}
      loading={loading}
      title="Finish posts stuck on media now (asks Mux and R2 directly), then re-queue older stuck uploads"
    >
      {!loading && <LifeBuoy />}
      {loading ? "Recovering..." : "Trigger media recovery"}
    </Button>
  );
}
