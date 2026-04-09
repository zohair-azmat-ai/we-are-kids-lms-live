"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

type VideoTileProps = {
  stream: MediaStream | null;
  title: string;
  subtitle?: string;
  muted?: boolean;
  priority?: boolean;
  isSpeaking?: boolean;
  className?: string;
};

export function VideoTile({
  stream,
  title,
  subtitle,
  muted = false,
  priority = false,
  isSpeaking = false,
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
    <motion.div
      className={`relative overflow-hidden rounded-[2rem] bg-slate-900 ${className}`}
      animate={{
        boxShadow: isSpeaking
          ? [
              "0 0 0 2px rgba(74,222,128,0.5), 0 0 10px rgba(74,222,128,0.15)",
              "0 0 0 3px rgba(74,222,128,0.9), 0 0 28px rgba(74,222,128,0.4)",
              "0 0 0 2px rgba(74,222,128,0.5), 0 0 10px rgba(74,222,128,0.15)",
            ]
          : "0 0 0 0px rgba(74,222,128,0)",
      }}
      transition={
        isSpeaking
          ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.4, ease: "easeOut" }
      }
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

      <AnimatePresence>
        {isSpeaking ? (
          <motion.div
            key="speaking-badge"
            initial={{ opacity: 0, y: -6, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.85 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-green-500/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Speaking
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-4 py-4">
        <p className={`font-semibold text-white ${priority ? "text-base" : "text-sm"}`}>
          {title}
        </p>
        {subtitle ? <p className="text-xs text-slate-300">{subtitle}</p> : null}
      </div>
    </motion.div>
  );
}
