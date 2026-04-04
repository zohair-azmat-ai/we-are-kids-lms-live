"use client";

import { useEffect, useRef } from "react";

type VideoTileProps = {
  stream: MediaStream | null;
  title: string;
  subtitle?: string;
  muted?: boolean;
  priority?: boolean;
  className?: string;
};

export function VideoTile({
  stream,
  title,
  subtitle,
  muted = false,
  priority = false,
  className = "",
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] bg-slate-900 ${className}`}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-[180px] items-center justify-center px-6 text-center text-sm text-slate-300">
          Video will appear here when the connection is ready.
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-4 py-4">
        <p className={`font-semibold text-white ${priority ? "text-base" : "text-sm"}`}>
          {title}
        </p>
        {subtitle ? <p className="text-xs text-slate-300">{subtitle}</p> : null}
      </div>
    </div>
  );
}
