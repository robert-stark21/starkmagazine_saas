"use client";
import { useState } from "react";

/**
 * Light YouTube player: a thumbnail with a play button, and the privacy-friendly
 * youtube-nocookie player only once it is wanted. With `autoMuted` (desktop hover) it
 * starts playing muted straight away. Unmounting it (popup closed) stops the video.
 */
export function YtLite({ id, title, autoMuted = false, playLabel }: { id: string; title: string; autoMuted?: boolean; playLabel: string }) {
  const [on, setOn] = useState<"off" | "muted" | "sound">(autoMuted ? "muted" : "off");
  if (on !== "off") {
    const params = `autoplay=1&rel=0&modestbranding=1&playsinline=1${on === "muted" ? "&mute=1" : ""}`;
    return (
      <div className="yt">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?${params}`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  return (
    <button type="button" className="yt yt-lite" onClick={() => setOn("sound")} aria-label={`${playLabel}: ${title}`}>
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="eager" decoding="async" />
      <span className="yt-play" aria-hidden="true">
        <svg viewBox="0 0 68 48" width="56" height="40"><path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2.3 34 .3 34 .3s-21.2 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3z" fill="#f00" /><path d="M45 24 27 14v20z" fill="#fff" /></svg>
      </span>
    </button>
  );
}

/** True on devices with a mouse, where opening by hover may start a muted preview. */
export const canHover = () => typeof matchMedia !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;
