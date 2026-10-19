import { useAuthStore } from "@/stores/auth";

/** Upload team-message media through the authenticated API to avoid R2 CORS. */
export async function uploadTeamMediaAsset(file: File, mediaAssetId: string, isVideo: boolean) {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error("Your session expired. Sign in again and retry.");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!apiUrl) throw new Error("The API URL is not configured.");

  const response = await fetch(
    `${apiUrl}/media-assets/${encodeURIComponent(mediaAssetId)}/upload`,
    {
      method: "PUT",
      body: file,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      },
    },
  );

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error ?? `Upload failed (${response.status})`);
  }
}
