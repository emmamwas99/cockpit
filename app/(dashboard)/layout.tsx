import { AuthGuard } from "@/components/layout/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TeamInboxSync } from "@/components/team/team-inbox-sync";
import { PendingReviewSync } from "@/components/posts/pending-review-sync";
import { DraftAttentionSync } from "@/components/drafts/draft-attention-sync";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <TeamInboxSync />
      <PendingReviewSync />
      <DraftAttentionSync />
      <div className="flex min-h-screen bg-canvas">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1440px] space-y-5 p-4 md:p-6">{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
