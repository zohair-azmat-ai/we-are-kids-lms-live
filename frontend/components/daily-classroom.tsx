"use client";

import { useEffect, useRef, useState } from "react";
import type { DailyCall, DailyEvent } from "@daily-co/daily-js";

interface DailyClassroomProps {
  roomUrl: string;
  token: string;
  userName?: string;
  onLeave?: () => void;
}

export default function DailyClassroom({ roomUrl, token, userName, onLeave }: DailyClassroomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<DailyCall | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        const DailyIframe = (await import("@daily-co/daily-js")).default;

        if (!containerRef.current || destroyed) return;

        const frame = DailyIframe.createFrame(containerRef.current, {
          iframeStyle: {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            border: "none",
            borderRadius: "0",
          },
          showLeaveButton: true,
          showFullscreenButton: true,
          showUserNameChangeUI: false,
        });

        frameRef.current = frame;

        frame.on("left-meeting" as DailyEvent, () => {
          if (!destroyed) onLeave?.();
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        frame.on("error", (evt: any) => {
          const message = evt && evt.errorMsg ? evt.errorMsg : "Video call error.";
          if (!destroyed) setError(message);
        });

        frame.on("joined-meeting" as DailyEvent, () => {
          if (!destroyed) setJoined(true);
        });

        console.log("[Daily] joining —", { roomUrl, userName });
        await frame.join({
          url: roomUrl,
          token,
          userName: userName ?? "Participant",
        });
      } catch (err: unknown) {
        if (!destroyed) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[Daily] join error:", err);
          setError(msg || "Failed to join video call.");
        }
      }
    }

    void init();

    return () => {
      destroyed = true;
      frameRef.current?.destroy().catch(() => {});
      frameRef.current = null;
    };
    // roomUrl and token are stable for the session lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token]);

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#0f172a" }}>
        <div style={{ textAlign: "center", padding: 32, maxWidth: 400 }}>
          <p style={{ color: "#f87171", fontSize: 14, marginBottom: 20 }}>{error}</p>
          <button
            onClick={onLeave}
            style={{ padding: "8px 24px", borderRadius: 8, background: "#475569", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}
          >
            Leave
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0f172a" }}>
      {!joined && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #10b981", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13, color: "#94a3b8" }}>Connecting to classroom…</p>
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
