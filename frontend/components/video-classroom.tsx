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
  selectHMSMessages,
} from "@100mslive/react-sdk";
import type { HMSPeer, HMSMessage } from "@100mslive/react-sdk";
import { getAccessToken } from "@/lib/demo-auth";

interface VideoClassroomProps {
  classId: string;
  userName?: string;
  isTeacher?: boolean;
  onLeave?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Status / error screen ────────────────────────────────────────────────────

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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#0f172a" }}>
      <div style={{ textAlign: "center", padding: 32, maxWidth: 420 }}>
        {spinning && <Spinner />}
        <p style={{ fontSize: 13, color: isError ? "#f87171" : "#94a3b8", marginBottom: isError ? 20 : 0 }}>
          {message}
        </p>
        {isError && onLeave && (
          <button
            onClick={onLeave}
            style={{ padding: "8px 24px", borderRadius: 8, background: "#475569", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}
          >
            Leave
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Video tile ───────────────────────────────────────────────────────────────

type TileSize = "grid" | "large" | "small";

function VideoTile({ peer, size = "grid", onClick }: { peer: HMSPeer; size?: TileSize; onClick?: () => void }) {
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
  const avatarSize = size === "large" ? 64 : size === "small" ? 32 : 52;
  const nameFontSize = size === "large" ? 13 : 10;

  const containerStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = {
      position: "relative",
      background: "#1e293b",
      borderRadius: size === "small" ? 6 : 8,
      overflow: "hidden",
      cursor: onClick ? "pointer" : "default",
      flexShrink: 0,
    };
    if (size === "large") return { ...base, width: "100%", height: "100%" };
    if (size === "small") return { ...base, width: 128, height: 96 };
    return { ...base, aspectRatio: "16/9" };
  })();

  return (
    <div style={containerStyle} onClick={onClick} title={onClick ? (size === "large" ? "Click to exit focus" : "Click to focus") : undefined}>
      <video
        ref={videoRef} autoPlay muted={peer.isLocal} playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", display: videoOn ? "block" : "none" }}
      />
      {!videoOn && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: avatarSize * 0.42 }}>
            👤
          </div>
        </div>
      )}
      <div style={{ position: "absolute", bottom: size === "small" ? 4 : 8, left: size === "small" ? 4 : 8, background: "rgba(0,0,0,0.65)", borderRadius: 4, padding: size === "small" ? "1px 5px" : "2px 8px", fontSize: nameFontSize, color: "#fff", fontWeight: 600, maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {peer.name ?? "Participant"} {peer.isLocal ? "(You)" : ""}
      </div>
      {size === "large" && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "2px 8px", fontSize: 10, color: "#94a3b8" }}>
          click to exit focus
        </div>
      )}
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({
  messages,
  localPeerId,
  inputMessage,
  onInputChange,
  onSend,
  onClose,
  mobile,
}: {
  messages: HMSMessage[];
  localPeerId: string;
  inputMessage: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
  mobile: boolean;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const panelStyle: React.CSSProperties = mobile
    ? {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 48, // above controls bar
        height: "58vh",
        zIndex: 50,
        background: "#0f172a",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        flexDirection: "column",
      }
    : {
        width: 300,
        flexShrink: 0,
        background: "#080f1f",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
      };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Chat</span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}
          title="Close chat"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontSize: 12, color: "#475569", textAlign: "center" }}>No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender === localPeerId;
            return (
              <div
                key={msg.id}
                style={{ display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}
              >
                {/* Sender + time */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isOwn ? "#34d399" : "#818cf8" }}>
                    {isOwn ? "You" : (msg.senderName ?? "Participant")}
                  </span>
                  <span style={{ fontSize: 9, color: "#334155" }}>{formatTime(msg.time)}</span>
                </div>
                {/* Bubble */}
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "6px 10px",
                    borderRadius: isOwn ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    background: isOwn ? "#1e40af" : "#1e293b",
                    color: "#f1f5f9",
                    fontSize: 12,
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, display: "flex", gap: 6, padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <input
          value={inputMessage}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Type a message…"
          style={{
            flex: 1,
            background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: "7px 10px",
            fontSize: 12,
            color: "#f1f5f9",
            outline: "none",
          }}
        />
        <button
          onClick={onSend}
          disabled={!inputMessage.trim()}
          style={{
            padding: "7px 12px",
            borderRadius: 8,
            background: inputMessage.trim() ? "#1d4ed8" : "#1e293b",
            color: inputMessage.trim() ? "#fff" : "#475569",
            border: "none",
            cursor: inputMessage.trim() ? "pointer" : "default",
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ─── Inner call component ─────────────────────────────────────────────────────

const JOIN_TIMEOUT_MS = 15_000;

function VideoCall({ token, userName, onLeave }: { token: string; userName: string; onLeave?: () => void }) {
  const hmsActions = useHMSActions();
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const peers = useHMSStore(selectPeers);
  const isAudioEnabled = useHMSStore(selectIsLocalAudioEnabled);
  const isVideoEnabled = useHMSStore(selectIsLocalVideoEnabled);
  const hmsMessages = useHMSStore(selectHMSMessages);

  const [error, setError] = useState<string | null>(null);
  const [joiningText, setJoiningText] = useState("Joining room…");
  const [focusedPeerId, setFocusedPeerId] = useState<string | null>(null);

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const lastSeenMsgCountRef = useRef(0);

  // Join refs
  const hasJoinedRef = useRef(false);
  const isConnectedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect mobile viewport
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 640); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Keep isConnectedRef in sync
  useEffect(() => {
    isConnectedRef.current = !!isConnected;
    if (isConnected) {
      console.log("[VideoClassroom] isConnected=true — peers:", peers.length);
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    }
  }, [isConnected, peers.length]);

  // Auto-reset focus when focused peer leaves
  useEffect(() => {
    if (focusedPeerId && !peers.find((p) => p.id === focusedPeerId)) {
      setFocusedPeerId(null);
    }
  }, [peers, focusedPeerId]);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!isChatOpen) {
      const newUnread = hmsMessages.length - lastSeenMsgCountRef.current;
      if (newUnread > 0) {
        setUnreadCount(newUnread);
        console.log("[VideoClassroom] Chat message received. Total unread:", newUnread);
      }
    }
  }, [hmsMessages.length, isChatOpen]);

  // Clear unread when chat opens
  function openChat() {
    setIsChatOpen(true);
    setUnreadCount(0);
    lastSeenMsgCountRef.current = hmsMessages.length;
    console.log("[VideoClassroom] Chat opened. Marked", hmsMessages.length, "messages as read.");
  }

  // Join — guarded against StrictMode double-run
  useEffect(() => {
    if (hasJoinedRef.current) return;
    hasJoinedRef.current = true;

    console.log("[VideoClassroom] Starting join. userName:", userName, "token prefix:", token.slice(0, 30) + "…");
    setJoiningText("Joining room…");

    timeoutRef.current = setTimeout(() => {
      if (!isConnectedRef.current) {
        console.error("[VideoClassroom] join timeout after 15s");
        setError("100ms join timeout — room did not connect within 15 seconds.");
      }
    }, JOIN_TIMEOUT_MS);

    hmsActions
      .join({ authToken: token, userName, settings: { isAudioMuted: true, isVideoMuted: true } })
      .then(() => {
        console.log("[VideoClassroom] hmsActions.join() resolved");
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        setJoiningText("Connected");
      })
      .catch((err: unknown) => {
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[VideoClassroom] join rejected:", msg, err);
        setError(`Join failed: ${msg}`);
      });

    return () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLeave() {
    await hmsActions.leave().catch(() => {});
    onLeave?.();
  }

  async function sendChatMessage() {
    const text = inputMessage.trim();
    if (!text) return;
    console.log("[VideoClassroom] Sending chat:", text);
    try {
      await hmsActions.sendBroadcastMessage(text);
      setInputMessage("");
      console.log("[VideoClassroom] Chat sent successfully");
    } catch (err) {
      console.error("[VideoClassroom] Chat send failed:", err);
    }
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return <StatusScreen spinning={false} message={error} isError onLeave={onLeave} />;

  // ── Connecting ────────────────────────────────────────────────────────────
  if (!isConnected) return <StatusScreen spinning message={joiningText} />;

  // ── Connected ─────────────────────────────────────────────────────────────
  const localPeer = peers.find((p) => p.isLocal);
  const localPeerId = localPeer?.id ?? "";

  const focusedPeer = focusedPeerId ? peers.find((p) => p.id === focusedPeerId) ?? null : null;
  const stripPeers = focusedPeer ? peers.filter((p) => p.id !== focusedPeerId) : [];
  const gridCols = peers.length <= 1 ? "1fr" : peers.length === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)";

  // Controls button style helper
  const ctrlBtn = (bg: string, active = true): React.CSSProperties => ({
    padding: "7px 12px",
    borderRadius: 8,
    background: bg,
    color: "#fff",
    border: "none",
    cursor: active ? "pointer" : "default",
    fontSize: 12,
    fontWeight: 600,
    position: "relative",
    flexShrink: 0,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Main content row: video + desktop chat panel ─────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden", minHeight: 0 }}>

        {/* Video section */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {focusedPeer ? (
            // Focus mode
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, padding: "12px 12px 8px", overflow: "hidden" }}>
                <VideoTile peer={focusedPeer} size="large" onClick={() => setFocusedPeerId(null)} />
              </div>
              {stripPeers.length > 0 && (
                <div style={{ flexShrink: 0, display: "flex", gap: 8, overflowX: "auto", padding: "0 12px 10px", scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}>
                  {stripPeers.map((peer) => (
                    <VideoTile key={peer.id} peer={peer} size="small" onClick={() => setFocusedPeerId(peer.id)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Grid mode
            <div style={{ flex: 1, overflow: "auto", padding: 12, display: "grid", gap: 10, gridTemplateColumns: gridCols, alignContent: "start" }}>
              {peers.map((peer) => (
                <VideoTile key={peer.id} peer={peer} size="grid" onClick={() => setFocusedPeerId(peer.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Desktop chat panel (inline, right side) */}
        {isChatOpen && !isMobile && (
          <ChatPanel
            messages={hmsMessages}
            localPeerId={localPeerId}
            inputMessage={inputMessage}
            onInputChange={setInputMessage}
            onSend={() => void sendChatMessage()}
            onClose={() => setIsChatOpen(false)}
            mobile={false}
          />
        )}
      </div>

      {/* Mobile chat panel (fixed overlay above controls) */}
      {isChatOpen && isMobile && (
        <ChatPanel
          messages={hmsMessages}
          localPeerId={localPeerId}
          inputMessage={inputMessage}
          onInputChange={setInputMessage}
          onSend={() => void sendChatMessage()}
          onClose={() => setIsChatOpen(false)}
          mobile
        />
      )}

      {/* ── Controls bar ────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 14px", background: "rgba(15,23,42,0.97)", borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>

        <button onClick={() => hmsActions.setLocalAudioEnabled(!isAudioEnabled)} style={ctrlBtn(isAudioEnabled ? "#334155" : "#dc2626")}>
          {isAudioEnabled ? "🎙 Mute" : "🔇 Unmute"}
        </button>

        <button onClick={() => hmsActions.setLocalVideoEnabled(!isVideoEnabled)} style={ctrlBtn(isVideoEnabled ? "#334155" : "#dc2626")}>
          {isVideoEnabled ? "📷 Cam Off" : "📷 Cam On"}
        </button>

        {focusedPeerId && (
          <button onClick={() => setFocusedPeerId(null)} style={ctrlBtn("#1e40af")}>
            ⊞ Grid
          </button>
        )}

        {/* Chat toggle with unread badge */}
        <button
          onClick={() => { if (isChatOpen) { setIsChatOpen(false); } else { openChat(); } }}
          style={{ ...ctrlBtn(isChatOpen ? "#0f766e" : "#334155"), position: "relative" }}
        >
          💬 Chat
          {!isChatOpen && unreadCount > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <button onClick={() => void handleLeave()} style={ctrlBtn("#7f1d1d")}>
          Leave
        </button>
      </div>
    </div>
  );
}

// ─── Outer component ─────────────────────────────────────────────────────────

export default function VideoClassroom({ classId, userName, isTeacher, onLeave }: VideoClassroomProps) {
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
          headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
          body: JSON.stringify({ class_id: classId, is_teacher: isTeacher ?? false }),
        });

        const text = await res.text();
        console.log("[VideoClassroom] Token response status:", res.status, "body:", text.slice(0, 300));

        let data: { token?: string; detail?: string };
        try { data = JSON.parse(text) as { token?: string; detail?: string }; }
        catch { throw new Error(`Backend returned non-JSON (${res.status}): ${text.slice(0, 200)}`); }

        if (!res.ok) throw new Error(data.detail ?? `Backend error ${res.status}`);
        if (!data.token) throw new Error("Backend response missing token field");

        if (!cancelled) {
          console.log("[VideoClassroom] Token fetch succeeded.");
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
    return <StatusScreen spinning={false} message={fetchError ?? "Failed to set up classroom."} isError onLeave={onLeave} />;
  }

  if (fetchStatus === "fetching" || !token) {
    return <StatusScreen spinning message="Fetching token…" />;
  }

  return (
    <HMSRoomProvider>
      <VideoCall token={token} userName={userName ?? "Participant"} onLeave={onLeave} />
    </HMSRoomProvider>
  );
}
