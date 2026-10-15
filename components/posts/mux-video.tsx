"use client";

import dynamic from "next/dynamic";

/**
 * Plays a Mux video in the admin. Shopi stores HLS (`.m3u8`) playback, which a
 * plain <video> can't play outside Safari — Mux Player handles HLS everywhere.
 * Loaded on demand so the player only ships when a video is actually opened.
 */
const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-full animate-pulse rounded-lg bg-black/80" />,
});

export function MuxVideo({
  playbackId,
  poster,
  title,
}: {
  playbackId: string;
  poster?: string | null;
  title?: string;
}) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      streamType="on-demand"
      poster={poster ?? undefined}
      accentColor="#d81470"
      metadataVideoTitle={title}
      title={title}
      className="block aspect-[9/16] w-full overflow-hidden rounded-lg bg-black"
    />
  );
}
