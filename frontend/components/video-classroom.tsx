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

// ─── Spinner helper ───────────────────────────────────────────────────────────

function Spinner() {
  return (
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
  );
}

// ─── Centered status/error screen ────────────────────────────────────────────

function StatusScreen({
  spinning,
  message,
  isError,
  onLeave,
}: {
  spinning: boolean;
  message: string;
  isError?: boolean;
  onLeave?: () => void;
}) {
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
      <div style={{ textAlign: "center", padding: 32, maxWidth: 420 }}>
        {spinning && <Spinner />}
        <p
          style={{
            fontSize: 13,
            color: isError ? "#f87171" : "#94a3b8",
            marginBottom: isError ? 20 : 0,
          }}
        >
          {message}
        </p>
        {isError && onLeave && (
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
        )}
      </div>
    </div>
  );
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
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: videoOn ? "block" : "none",
        }}
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

const JOIN_TIMEOUT_MS = 15_000;

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
  // isConnected is the single source of truth for whether to show the room
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const peers = useHMSStore(selectPeers);
  const isAudioEnabled = useHMSStore(selectIsLocalAudioEnabled);
  const isVideoEnabled = useHMSStore(selectIsLocalVideoEnabled);

  const [error, setError] = useState<string | null>(null);
  const [joiningText, setJoiningText] = useState("Joining room…");

  // Ref guard: prevents double-join in React StrictMode (effects run twice in dev)
  const hasJoinedRef = useRef(false);
  // Ref mirror of isConnected: lets the timeout callback read current value
  // without a stale closure (the timeout effect only runs once, on [token] change)
  const isConnectedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep isConnectedRef current and clear the timeout once we're in
  useEffect(() => {
    isConnectedRef.current = isConnected;
    if (isConnected) {
      console.log("[VideoClassroom] isConnected=true — peers:", peers.length);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [isConnected, peers.length]);

  // Initiate join — runs once per token, guarded against StrictMode double-run
  useEffect(() => {
    if (hasJoinedRef.current) {
      console.log("[VideoClassroom] Join already initiated — skipping duplicate (StrictMode).");
      return;
    }
    hasJoinedRef.current = true;

    console.log(
      "[VideoClassroom] Starting join. userName:", userName,
      "token prefix:", token.slice(0, 30) + "…",
    );
    setJoiningText("Joining room…");

    // Timeout uses isConnectedRef (not closure over state) to avoid stale reads
    timeoutRef.current = setTimeout(() => {
      if (!isConnectedRef.current) {
        console.error("[VideoClassroom] join timeout after 15s — not connected");
        setError("100ms join timeout — room did not connect within 15 seconds.");
      }
    }, JOIN_TIMEOUT_MS);

    hmsActions
      .join({
        authToken: token,
        userName,
        // Start muted — camera/mic permission denial must NOT block room entry
        settings: { isAudioMuted: true, isVideoMuted: true },
      })
      .then(() => {
        console.log("[VideoClassroom] hmsActions.join() resolved — waiting for store update");
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setJoiningText("Connected");
      })
      .catch((err: unknown) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[VideoClassroom] hmsActions.join() rejected:", msg, err);
        setError(`Join failed: ${msg}`);
      });

    // IMPORTANT: do NOT call hmsActions.leave() here.
    // In React StrictMode dev, cleanup runs between the two effect invocations.
    // Calling leave() would cancel the in-progress join and leave the SDK in a
    // broken state for the second invocation. HMSRoomProvider cleans up on unmount.
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLeave() {
    await hmsActions.leave().catch(() => {});
    onLeave?.();
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <StatusScreen
        spinning={false}
        message={error}
        isError
        onLeave={onLeave}
      />
    );
  }

  // ── Not yet connected — show current join phase ───────────────────────────
  // Use isConnected (HMS store) as the single gate — no secondary joinStatus
  // state that can lag behind and cause an extra render cycle of stuck spinner.
  if (!isConnected) {
    return <StatusScreen spinning message={joiningText} />;
  }

  // ── Connected — render the room ───────────────────────────────────────────
  console.log("[VideoClassroom] Rendering room. Peers:", peers.length);

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
  const [fetchStatus, setFetchStatus] = useState<"fetching" | "done" | "error">("fetching");
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      console.log("[VideoClassroom] Fetching HMS token. classId:", classId, "isTeacher:", isTeacher);
      setFetchStatus("fetching");

      try {
        const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
        const accessToken = getAccessToken();
        console.log("[VideoClassroom] API base:", apiBase);

        const res = await fetch(`${apiBase}/api/v1/hms/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ class_id: classId, is_teacher: isTeacher ?? false }),
        });

        // Read as text first so non-JSON backend errors show a useful message
        const text = await res.text();
        console.log("[VideoClassroom] Token response status:", res.status, "body:", text.slice(0, 300));

        let data: { token?: string; detail?: string };
        try {
          data = JSON.parse(text) as { token?: string; detail?: string };
        } catch {
          throw new Error(`Backend returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
        }

        if (!res.ok) throw new Error(data.detail ?? `Backend error ${res.status}`);
        if (!data.token) throw new Error("Backend response missing token field");

        if (!cancelled) {
          console.log("[VideoClassroom] Token fetch succeeded. Token prefix:", data.token.slice(0, 30) + "…");
          setToken(data.token);
          setFetchStatus("done");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to set up classroom";
          console.error("[VideoClassroom] Token fetch error:", err);
          setFetchError(msg);
          setFetchStatus("error");
        }
      }
    }

    void fetchToken();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  if (fetchStatus === "error") {
    return (
      <StatusScreen
        spinning={false}
        message={fetchError ?? "Failed to set up classroom."}
        isError
        onLeave={onLeave}
      />
    );
  }

  if (fetchStatus === "fetching" || !token) {
    return <StatusScreen spinning message="Fetching token…" />;
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
