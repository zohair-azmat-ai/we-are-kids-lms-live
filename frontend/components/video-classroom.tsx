"use client";

import { useEffect, useRef, useState } from "react";
import {
  HMSRoomProvider,
  useHMSActions,
  useHMSStore,
  selectIsConnectedToRoom,
  selectPeers,
  selectVideoTrackByID,
  selectIsLocalAudioEnabled,
  selectIsLocalVideoEnabled,
} from "@100mslive/react-sdk";
import type { HMSPeer } from "@100mslive/react-sdk";
import { getAccessToken } from "@/lib/demo-auth";

interface VideoClassroomProps {
  classId: string;
  userName?: string;
  isTeacher?: boolean;
  onLeave?: () => void;
}

// ─── Video tile for a single peer ────────────────────────────────────────────

function VideoTile({ peer }: { peer: HMSPeer }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hmsActions = useHMSActions();
  const videoTrack = useHMSStore(selectVideoTrackByID(peer.videoTrack ?? ""));

  useEffect(() => {
    if (videoTrack && !videoTrack.degraded && videoRef.current) {
      hmsActions.attachVideo(videoTrack.id, videoRef.current);
    }
    return () => {
      if (videoTrack && videoRef.current) {
        hmsActions.detachVideo(videoTrack.id, videoRef.current).catch(() => {});
      }
    };
  }, [videoTrack, hmsActions]);

  const videoOn = videoTrack && videoTrack.enabled;

  return (
    <div
      style={{
        position: "relative",
        background: "#1e293b",
        borderRadius: 8,
        overflow: "hidden",
        aspectRatio: "16/9",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted={peer.isLocal}
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", display: videoOn ? "block" : "none" }}
      />
      {!videoOn && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              fontSize: 22,
            }}
          >
            👤
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          background: "rgba(0,0,0,0.65)",
          borderRadius: 4,
          padding: "2px 8px",
          fontSize: 11,
          color: "#fff",
          fontWeight: 600,
        }}
      >
        {peer.name ?? "Participant"} {peer.isLocal ? "(You)" : ""}
      </div>
    </div>
  );
}

// ─── Inner call component — must live inside HMSRoomProvider ─────────────────

function VideoCall({
  token,
  userName,
  onLeave,
}: {
  token: string;
  userName: string;
  onLeave?: () => void;
}) {
  const hmsActions = useHMSActions();
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const peers = useHMSStore(selectPeers);
  const isAudioEnabled = useHMSStore(selectIsLocalAudioEnabled);
  const isVideoEnabled = useHMSStore(selectIsLocalVideoEnabled);

  useEffect(() => {
    hmsActions
      .join({
        authToken: token,
        userName,
        settings: { isAudioMuted: false, isVideoMuted: false },
      })
      .catch(console.error);

    return () => {
      hmsActions.leave().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLeave() {
    await hmsActions.leave().catch(() => {});
    onLeave?.();
  }

  if (!isConnected) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          background: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "3px solid #10b981",
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Connecting to classroom…</p>
        </div>
      </div>
    );
  }

  const cols =
    peers.length <= 1 ? "1fr" : peers.length === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Video grid */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 16,
          display: "grid",
          gap: 12,
          gridTemplateColumns: cols,
          alignContent: "start",
        }}
      >
        {peers.map((peer) => (
          <VideoTile key={peer.id} peer={peer} />
        ))}
      </div>

      {/* Controls */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "12px 16px",
          background: "rgba(15,23,42,0.97)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => hmsActions.setLocalAudioEnabled(!isAudioEnabled)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: isAudioEnabled ? "#334155" : "#dc2626",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {isAudioEnabled ? "🎙 Mute" : "🔇 Unmute"}
        </button>

        <button
          onClick={() => hmsActions.setLocalVideoEnabled(!isVideoEnabled)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: isVideoEnabled ? "#334155" : "#dc2626",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {isVideoEnabled ? "📷 Hide Cam" : "📷 Show Cam"}
        </button>

        <button
          onClick={() => void handleLeave()}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#7f1d1d",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Leave
        </button>
      </div>
    </div>
  );
}

// ─── Outer component — fetches token, provides HMS context ───────────────────

export default function VideoClassroom({
  classId,
  userName,
  isTeacher,
  onLeave,
}: VideoClassroomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      try {
        const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
        const accessToken = getAccessToken();
        const res = await fetch(`${apiBase}/api/v1/hms/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ class_id: classId, is_teacher: isTeacher ?? false }),
        });
        const data = (await res.json()) as { token?: string; detail?: string };
        if (!res.ok) throw new Error(data.detail ?? "Failed to get classroom token");
        if (!cancelled && data.token) setToken(data.token);
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to set up classroom";
          console.error("[VideoClassroom] token fetch error:", err);
          setError(msg);
        }
      }
    }

    void fetchToken();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          background: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", padding: 32, maxWidth: 400 }}>
          <p style={{ color: "#f87171", fontSize: 14, marginBottom: 20 }}>{error}</p>
          <button
            onClick={onLeave}
            style={{
              padding: "8px 24px",
              borderRadius: 8,
              background: "#475569",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Leave
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          background: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "3px solid #10b981",
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 12px",
            }}
          />
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Setting up classroom…</p>
        </div>
      </div>
    );
  }

  return (
    <HMSRoomProvider>
      <VideoCall
        token={token}
        userName={userName ?? "Participant"}
        onLeave={onLeave}
      />
    </HMSRoomProvider>
  );
}
