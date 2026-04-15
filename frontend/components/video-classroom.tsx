"use client";

import { useEffect, useRef, useState } from "react";
import {
  HMSRoomProvider,
  useHMSActions,
  useHMSStore,
  useScreenShare,
  selectIsConnectedToRoom,
  selectPeers,
  selectVideoTrackByID,
  selectIsLocalAudioEnabled,
  selectIsLocalVideoEnabled,
  selectHMSMessages,
  selectIsPeerAudioEnabled,
  selectIsPeerVideoEnabled,
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
    <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #10b981", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Status / error screen ────────────────────────────────────────────────────

function StatusScreen({ spinning, message, isError, onLeave }: { spinning: boolean; message: string; isError?: boolean; onLeave?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#0f172a" }}>
      <div style={{ textAlign: "center", padding: 32, maxWidth: 420 }}>
        {spinning && <Spinner />}
        <p style={{ fontSize: 13, color: isError ? "#f87171" : "#94a3b8", marginBottom: isError ? 20 : 0 }}>{message}</p>
        {isError && onLeave && (
          <button onClick={onLeave} style={{ padding: "8px 24px", borderRadius: 8, background: "#475569", color: "#fff", border: "none", cursor: "pointer", fontSize: 13 }}>
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

  const containerStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = { position: "relative", background: "#1e293b", borderRadius: size === "small" ? 6 : 8, overflow: "hidden", cursor: onClick ? "pointer" : "default", flexShrink: 0 };
    if (size === "large") return { ...base, width: "100%", height: "100%" };
    if (size === "small") return { ...base, width: 128, height: 96 };
    return { ...base, aspectRatio: "16/9" };
  })();

  return (
    <div style={containerStyle} onClick={onClick} title={onClick ? (size === "large" ? "Click to exit focus" : "Click to focus") : undefined}>
      <video ref={videoRef} autoPlay muted={peer.isLocal} playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: videoOn ? "block" : "none" }} />
      {!videoOn && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: avatarSize * 0.42 }}>👤</div>
        </div>
      )}
      <div style={{ position: "absolute", bottom: size === "small" ? 4 : 8, left: size === "small" ? 4 : 8, background: "rgba(0,0,0,0.65)", borderRadius: 4, padding: size === "small" ? "1px 5px" : "2px 8px", fontSize: size === "small" ? 10 : 11, color: "#fff", fontWeight: 600, maxWidth: "90%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {peer.name ?? "Participant"}{peer.isLocal ? " (You)" : ""}
      </div>
      {size === "large" && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "2px 8px", fontSize: 10, color: "#94a3b8" }}>
          click to exit focus
        </div>
      )}
    </div>
  );
}

// ─── Screen share tile ────────────────────────────────────────────────────────

function ScreenShareTile({ trackId, peerName, onClick }: { trackId: string; peerName?: string; onClick?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hmsActions = useHMSActions();

  useEffect(() => {
    if (trackId && videoRef.current) {
      hmsActions.attachVideo(trackId, videoRef.current);
      console.log("[VideoClassroom] Screen share track attached:", trackId);
    }
    return () => {
      if (trackId && videoRef.current) {
        hmsActions.detachVideo(trackId, videoRef.current).catch(() => {});
      }
    };
  }, [trackId, hmsActions]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0a0f1e", borderRadius: 8, overflow: "hidden", cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(16,185,129,0.85)", borderRadius: 4, padding: "3px 10px", fontSize: 11, color: "#fff", fontWeight: 700 }}>
        🖥 {peerName ? `${peerName}'s screen` : "Screen Share"}
      </div>
      {onClick && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "2px 8px", fontSize: 10, color: "#94a3b8" }}>
          click to exit focus
        </div>
      )}
    </div>
  );
}

// ─── Participant row ──────────────────────────────────────────────────────────

function ParticipantRow({ peer }: { peer: HMSPeer }) {
  const isAudioOn = useHMSStore(selectIsPeerAudioEnabled(peer.id));
  const isVideoOn = useHMSStore(selectIsPeerVideoEnabled(peer.id));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, flexShrink: 0 }}>👤</div>
      <span style={{ flex: 1, fontSize: 13, color: "#f1f5f9", fontWeight: peer.isLocal ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {peer.name ?? "Participant"}
        {peer.isLocal && <span style={{ color: "#64748b", fontWeight: 400, fontSize: 11 }}> (You)</span>}
      </span>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <span title={isAudioOn ? "Mic on" : "Mic off"} style={{ fontSize: 13, opacity: isAudioOn ? 1 : 0.3 }}>🎙</span>
        <span title={isVideoOn ? "Camera on" : "Camera off"} style={{ fontSize: 13, opacity: isVideoOn ? 1 : 0.3 }}>📷</span>
      </div>
    </div>
  );
}

// ─── Participants panel ───────────────────────────────────────────────────────

function ParticipantsPanel({ peers, onClose, mobile }: { peers: HMSPeer[]; onClose: () => void; mobile: boolean }) {
  const panelStyle: React.CSSProperties = mobile
    ? { position: "fixed", left: 0, right: 0, bottom: 52, height: "58vh", zIndex: 50, background: "#0f172a", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column" }
    : { width: 280, flexShrink: 0, background: "#080f1f", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" };

  return (
    <div style={panelStyle}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Participants ({peers.length})</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {peers.map((peer) => <ParticipantRow key={peer.id} peer={peer} />)}
      </div>
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({ messages, localPeerId, inputMessage, onInputChange, onSend, onClose, mobile }: {
  messages: HMSMessage[];
  localPeerId: string;
  inputMessage: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
  mobile: boolean;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const panelStyle: React.CSSProperties = mobile
    ? { position: "fixed", left: 0, right: 0, bottom: 52, height: "58vh", zIndex: 50, background: "#0f172a", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column" }
    : { width: 300, flexShrink: 0, background: "#080f1f", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" };

  return (
    <div style={panelStyle}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Chat</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontSize: 12, color: "#475569", textAlign: "center" }}>No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender === localPeerId;
            return (
              <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isOwn ? "#34d399" : "#818cf8" }}>
                    {isOwn ? "You" : (msg.senderName ?? "Participant")}
                  </span>
                  <span style={{ fontSize: 9, color: "#334155" }}>{formatTime(msg.time)}</span>
                </div>
                <div style={{ maxWidth: "85%", padding: "6px 10px", borderRadius: isOwn ? "12px 12px 4px 12px" : "12px 12px 12px 4px", background: isOwn ? "#1e40af" : "#1e293b", color: "#f1f5f9", fontSize: 12, lineHeight: 1.5, wordBreak: "break-word" }}>
                  {String(msg.message)}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ flexShrink: 0, display: "flex", gap: 6, padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <input
          value={inputMessage}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Type a message…"
          style={{ flex: 1, background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#f1f5f9", outline: "none" }}
        />
        <button
          onClick={onSend}
          disabled={!inputMessage.trim()}
          style={{ padding: "7px 12px", borderRadius: 8, background: inputMessage.trim() ? "#1d4ed8" : "#1e293b", color: inputMessage.trim() ? "#fff" : "#475569", border: "none", cursor: inputMessage.trim() ? "pointer" : "default", fontSize: 13, fontWeight: 600, flexShrink: 0 }}
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

  // Screen share
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const { amIScreenSharing, toggleScreenShare, screenSharingPeerId, screenSharingPeerName, screenShareVideoTrackId } = useScreenShare(
    (err) => { console.error("[VideoClassroom] Screen share error:", err); setScreenShareError(err.message); }
  );
  const isScreenShareSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  const [error, setError] = useState<string | null>(null);
  const [joiningText, setJoiningText] = useState("Joining room…");
  const [focusedPeerId, setFocusedPeerId] = useState<string | null>(null);
  const [screenShareFocused, setScreenShareFocused] = useState(false);

  // Panel: "chat" | "participants" | null
  const [activePanel, setActivePanel] = useState<"chat" | "participants" | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const lastSeenMsgCountRef = useRef(0);

  // Join refs
  const hasJoinedRef = useRef(false);
  const isConnectedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile detection
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
      console.log("[VideoClassroom] Focused peer left — resetting to grid");
      setFocusedPeerId(null);
    }
  }, [peers, focusedPeerId]);

  // Log participants updates
  useEffect(() => {
    if (isConnected) {
      console.log("[VideoClassroom] Participants updated. Count:", peers.length, peers.map(p => p.name));
    }
  }, [peers.length, isConnected]);

  // Auto-focus screen share when it starts; revert when it ends
  useEffect(() => {
    if (screenShareVideoTrackId) {
      console.log("[VideoClassroom] Screen share started — peer:", screenSharingPeerName, "trackId:", screenShareVideoTrackId);
      setScreenShareFocused(true);
      setFocusedPeerId(null);
    } else {
      if (screenShareFocused) {
        console.log("[VideoClassroom] Screen share ended — returning to grid");
        setScreenShareFocused(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenShareVideoTrackId]);

  // Clear screen share error after 5s
  useEffect(() => {
    if (!screenShareError) return;
    const t = setTimeout(() => setScreenShareError(null), 5000);
    return () => clearTimeout(t);
  }, [screenShareError]);

  // Unread message tracking
  useEffect(() => {
    if (activePanel === "chat") {
      lastSeenMsgCountRef.current = hmsMessages.length;
      setUnreadCount(0);
    } else {
      const newUnread = hmsMessages.length - lastSeenMsgCountRef.current;
      if (newUnread > 0) {
        setUnreadCount(newUnread);
        console.log("[VideoClassroom] Chat message received. Unread:", newUnread);
      }
    }
  }, [hmsMessages.length, activePanel]);

  function openPanel(panel: "chat" | "participants") {
    if (activePanel === panel) {
      setActivePanel(null);
    } else {
      setActivePanel(panel);
      if (panel === "chat") {
        setUnreadCount(0);
        lastSeenMsgCountRef.current = hmsMessages.length;
        console.log("[VideoClassroom] Chat opened.");
      } else {
        console.log("[VideoClassroom] Participants panel opened.");
      }
    }
  }

  // Join
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

  async function handleToggleScreenShare() {
    if (!toggleScreenShare) {
      console.warn("[VideoClassroom] Screen share not available — toggleScreenShare is undefined");
      setScreenShareError("Screen share is not available for your role.");
      return;
    }
    try {
      console.log("[VideoClassroom] Toggling screen share. Current:", amIScreenSharing);
      await toggleScreenShare();
      console.log("[VideoClassroom] Screen share toggled. Now:", !amIScreenSharing);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[VideoClassroom] Screen share toggle failed:", msg);
      setScreenShareError(msg);
    }
  }

  // ── Error / Connecting ────────────────────────────────────────────────────
  if (error) return <StatusScreen spinning={false} message={error} isError onLeave={onLeave} />;
  if (!isConnected) return <StatusScreen spinning message={joiningText} />;

  // ── Connected ─────────────────────────────────────────────────────────────
  const localPeer = peers.find((p) => p.isLocal);
  const localPeerId = localPeer?.id ?? "";
  const focusedPeer = focusedPeerId ? peers.find((p) => p.id === focusedPeerId) ?? null : null;
  const stripPeers = focusedPeer ? peers.filter((p) => p.id !== focusedPeerId) : [];
  const gridCols = peers.length <= 1 ? "1fr" : peers.length === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)";

  // Inline control button style
  const btn = (bg: string): React.CSSProperties => ({
    padding: "7px 11px",
    borderRadius: 8,
    background: bg,
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
    whiteSpace: "nowrap",
    position: "relative",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Main row: video + desktop side panel ─────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "row", overflow: "hidden", minHeight: 0 }}>

        {/* Video area */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Screen share error banner */}
          {screenShareError && (
            <div style={{ flexShrink: 0, background: "#7f1d1d", color: "#fecaca", fontSize: 12, padding: "6px 14px", textAlign: "center" }}>
              Screen share error: {screenShareError}
            </div>
          )}

          {/* Video content: screen share focus / peer focus / grid */}
          {screenShareFocused && screenShareVideoTrackId ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, padding: "12px 12px 8px", overflow: "hidden" }}>
                <ScreenShareTile
                  trackId={screenShareVideoTrackId}
                  peerName={screenSharingPeerName}
                  onClick={() => setScreenShareFocused(false)}
                />
              </div>
              {peers.length > 0 && (
                <div style={{ flexShrink: 0, display: "flex", gap: 8, overflowX: "auto", padding: "0 12px 10px", scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}>
                  {peers.map((peer) => (
                    <VideoTile key={peer.id} peer={peer} size="small" onClick={() => { setScreenShareFocused(false); setFocusedPeerId(peer.id); }} />
                  ))}
                </div>
              )}
            </div>
          ) : focusedPeer ? (
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
            <div style={{ flex: 1, overflow: "auto", padding: 12, display: "grid", gap: 10, gridTemplateColumns: gridCols, alignContent: "start" }}>
              {peers.map((peer) => (
                <VideoTile key={peer.id} peer={peer} size="grid" onClick={() => setFocusedPeerId(peer.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Desktop side panels */}
        {activePanel === "chat" && !isMobile && (
          <ChatPanel
            messages={hmsMessages}
            localPeerId={localPeerId}
            inputMessage={inputMessage}
            onInputChange={setInputMessage}
            onSend={() => void sendChatMessage()}
            onClose={() => setActivePanel(null)}
            mobile={false}
          />
        )}
        {activePanel === "participants" && !isMobile && (
          <ParticipantsPanel
            peers={peers}
            onClose={() => setActivePanel(null)}
            mobile={false}
          />
        )}
      </div>

      {/* Mobile overlays */}
      {activePanel === "chat" && isMobile && (
        <ChatPanel
          messages={hmsMessages}
          localPeerId={localPeerId}
          inputMessage={inputMessage}
          onInputChange={setInputMessage}
          onSend={() => void sendChatMessage()}
          onClose={() => setActivePanel(null)}
          mobile
        />
      )}
      {activePanel === "participants" && isMobile && (
        <ParticipantsPanel peers={peers} onClose={() => setActivePanel(null)} mobile />
      )}

      {/* ── Controls bar ────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", background: "rgba(15,23,42,0.97)", borderTop: "1px solid rgba(255,255,255,0.06)", overflowX: "auto", scrollbarWidth: "none" }}>

        {/* Mute */}
        <button onClick={() => hmsActions.setLocalAudioEnabled(!isAudioEnabled)} style={btn(isAudioEnabled ? "#334155" : "#dc2626")}>
          {isAudioEnabled ? "🎙 Mute" : "🔇 Unmute"}
        </button>

        {/* Camera */}
        <button onClick={() => hmsActions.setLocalVideoEnabled(!isVideoEnabled)} style={btn(isVideoEnabled ? "#334155" : "#dc2626")}>
          {isVideoEnabled ? "📷 Cam Off" : "📷 Cam On"}
        </button>

        {/* Grid reset (only in focus mode) */}
        {(focusedPeerId || screenShareFocused) && (
          <button onClick={() => { setFocusedPeerId(null); setScreenShareFocused(false); }} style={btn("#1e40af")}>
            ⊞ Grid
          </button>
        )}

        {/* Screen share */}
        {isScreenShareSupported && (
          <button onClick={() => void handleToggleScreenShare()} style={btn(amIScreenSharing ? "#0f766e" : "#334155")}>
            {amIScreenSharing ? "🖥 Stop Share" : "🖥 Share"}
          </button>
        )}

        {/* Participants */}
        <button
          onClick={() => openPanel("participants")}
          style={{ ...btn(activePanel === "participants" ? "#1e40af" : "#334155") }}
        >
          👥 People ({peers.length})
        </button>

        {/* Chat with unread badge */}
        <button
          onClick={() => openPanel("chat")}
          style={{ ...btn(activePanel === "chat" ? "#0f766e" : "#334155"), position: "relative" }}
        >
          💬 Chat
          {activePanel !== "chat" && unreadCount > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Leave — pushed to end */}
        <div style={{ flex: 1 }} />
        <button onClick={() => void handleLeave()} style={btn("#7f1d1d")}>
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
