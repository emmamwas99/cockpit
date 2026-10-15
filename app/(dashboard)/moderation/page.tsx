import { redirect } from "next/navigation";

/** Moderation queues are status tabs on Posts now; keep old links working. */
export default function ModerationPage() {
  redirect("/posts?tab=pending");
}
