"use client";

/**
 * LiveClassroomRoom — split Jitsi flow
 *
 * Teacher flow:
 *   1. Fetch LMS session + register presence
 *   2. Build the shared room URL
 *   3. window.open(url, "_blank") — opens Jitsi in a NEW TAB outside the iframe
 *      so the teacher can log in with Google and become moderator reliably.
 *   4. LMS stays open: teacher sees a control panel with recording + End Class.
 *      An "Open Classroom in Jitsi" button lets them reopen the tab if needed.
 *
 * Student flow:
 *   1-2. Same session fetch + presence
 *   3. Desktop: Jitsi embedded in a full-page iframe
 *      Mobile:  window.location.href redirect (iframe unstable on mobile)
 *
 * Room naming:
 *   wearekids-{classId-alphanum} — stable for the lifetime of the class so
 *   every participant joins the exact same room regardless of when they arrive.
 *   No timestamp suffix: teacher must be present first to unblock the room;
 *   the stable name ensures students find the same room the teacher opened.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import {
  ApiError,
  endLiveClass,
  getApiBaseUrl,
  joinClassPresence,
  leaveClassPresence,
  startRecordingSession,
  stopRecordingSession,
  type LiveClassSession,
} from "@/lib/api";
import { getAccessToken, isMainTeacherRole, isTeacherRole } from "@/lib/demo-auth";

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  classId: string;
  role: "teacher" | "student";
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Stable room name — same value for every participant in this class. */
function jitsiRoomName(classId: string): string {
  return `wearekids-${classId.replace(/[^a-zA-Z0-9]/g, "")}`;
}

/**
 * Build a fully-public meet.jit.si URL — no JWT, no login required.
 *
 * prejoinPageEnabled=false   — skip the pre-join lobby
 * requireDisplayName=false   — skip the "enter your name" prompt
 * userInfo.displayName       — pre-fill name so Jitsi doesn't ask
 */
function buildJitsiUrl(roomName: string, displayName?: string): string {
  const fragments = [
    "config.prejoinPageEnabled=false",
    "config.requireDisplayName=false",
  ];
  if (displayName) {
    fragments.push(`userInfo.displayName=${encodeURIComponent(displayName)}`);
  }
  return `https://meet.jit.si/${roomName}#${fragments.join("&")}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LiveClassroomRoom({ classId, role }: Props) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [session, setSession] = useState<LiveClassSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  // jitsiUrl is set for both teacher (for the "open again" button) and student (for iframe src)
  const [jitsiUrl, setJitsiUrl] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const hasInitializedRef = useRef(false);
  const isFetchingClassRef = useRef(false);
  const recordingIdRef = useRef<string | null>(null);
  const presenceJoinedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTeacher = user ? isTeacherRole(user.role) : role === "teacher";
  const isMainTeacher = user ? isMainTeacherRole(user.role) : false;
  const dashboardPath = isTeacher ? "/teacher/dashboard" : "/student/dashboard";

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = useCallback(async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (presenceJoinedRef.current && user) {
      presenceJoinedRef.current = false;
      try {
        await leaveClassPresence({
          classId,
          role: isTeacher ? "teacher" : "student",
          participantEmail: user.email,
          participantName: user.name,
        });
      } catch { /* non-fatal */ }
    }
  }, [classId, user, isTeacher]);

  // ── Retry ─────────────────────────────────────────────────────────────────

  function handleRetry() {
    hasInitializedRef.current = false;
    isFetchingClassRef.current = false;
    setError("");
    setCanRetry(false);
    setSessionExpired(false);
    setJitsiUrl("");
    setIsLoading(true);
    setRetryKey((k) => k + 1);
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (isAuthLoading || !user) return;
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const currentUser = user;
    let cancelled = false;

    async function initialize() {
      // ── Guard: LMS token must exist ────────────────────────────────────
      const token = getAccessToken();
      if (!token) {
        setSessionExpired(true);
        setError("Your session has expired. Please sign in again.");
        setIsLoading(false);
        return;
      }

      // ── Guard: prevent concurrent fetch ────────────────────────────────
      if (isFetchingClassRef.current) return;
      isFetchingClassRef.current = true;

      // ── Step 1: Fetch class session ────────────────────────────────────
      const apiBase = getApiBaseUrl();

      async function doFetchSession(): Promise<LiveClassSession> {
        const resp = await fetch(`${apiBase}/api/v1/classes/${classId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!resp.ok) {
          const body = (await resp.json().catch(() => ({}))) as { detail?: string };
          throw new ApiError(body.detail ?? "Class session request failed.", resp.status);
        }
        return resp.json() as Promise<LiveClassSession>;
      }

      async function fetchSessionWithRetry(): Promise<LiveClassSession> {
        try {
          return await doFetchSession();
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            await new Promise((r) => setTimeout(r, 500));
            if (cancelled) throw err;
            return doFetchSession();
          }
          throw err;
        }
      }

      let classSession: LiveClassSession;
      try {
        classSession = await fetchSessionWithRetry();
      } catch (fetchErr) {
        isFetchingClassRef.current = false;
        if (!cancelled) {
          if (fetchErr instanceof ApiError && fetchErr.status === 401) {
            setSessionExpired(true);
            setError("Your session has expired. Please sign in again.");
          } else {
            setError("Unable to load classroom. Please return to your dashboard.");
            setCanRetry(true);
          }
          setIsLoading(false);
        }
        return;
      }

      isFetchingClassRef.current = false;
      if (cancelled) return;

      // Students can only join a live session
      if (!isTeacher && classSession.status !== "live") {
        setError("This class is not live yet. Please wait for your teacher to start.");
        setIsLoading(false);
        return;
      }

      setSession(classSession);

      // ── Step 2: Register LMS presence ──────────────────────────────────
      try {
        await joinClassPresence({
          classId,
          role: isTeacher ? "teacher" : "student",
          participantEmail: currentUser.email,
          participantName: currentUser.name,
        });
        presenceJoinedRef.current = true;
      } catch { /* non-fatal */ }

      if (cancelled) return;

      // ── Step 3: Build shared room URL ──────────────────────────────────
      const roomName = jitsiRoomName(classId);
      const url = buildJitsiUrl(roomName, currentUser.name);
      console.log("[Jitsi] Room URL:", url, "| teacher:", isTeacher);

      // ── Teacher: open in a new tab, stay on LMS control panel ──────────
      if (isTeacher) {
        window.open(url, "_blank");
        setJitsiUrl(url); // stored so "Open Again" button works
        setIsLoading(false);

        // Poll to redirect back to dashboard when the class ends
        pollRef.current = setInterval(async () => {
          try {
            const resp = await fetch(`${apiBase}/api/v1/classes/${classId}`, {
              headers: { Authorization: `Bearer ${getAccessToken()}` },
              cache: "no-store",
            });
            if (resp.ok) {
              const updated = (await resp.json()) as LiveClassSession;
              if (updated.status === "ended") {
                void cleanup();
                router.push(dashboardPath);
              }
            }
          } catch { /* ignore */ }
        }, 15_000);
        return;
      }

      // ── Student: iframe on desktop, redirect on mobile ─────────────────
      const isMobile =
        typeof window !== "undefined" &&
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        console.log("[LiveClassroomRoom] Mobile student — redirecting:", url);
        window.location.href = url;
        return;
      }

      setJitsiUrl(url);
      setIsLoading(false);

      // Poll every 15 s — redirect when class ends
      pollRef.current = setInterval(async () => {
        try {
          const resp = await fetch(`${apiBase}/api/v1/classes/${classId}`, {
            headers: { Authorization: `Bearer ${getAccessToken()}` },
            cache: "no-store",
          });
          if (resp.ok) {
            const updated = (await resp.json()) as LiveClassSession;
            if (updated.status === "ended") {
              void cleanup();
              router.push(dashboardPath);
            }
          }
        } catch { /* ignore */ }
      }, 15_000);
    }

    void initialize().catch((err: unknown) => {
      if (!cancelled) {
        isFetchingClassRef.current = false;
        setError("Classroom failed to start. Please retry.");
        setCanRetry(true);
        setIsLoading(false);
        console.error("[LiveClassroomRoom] Unhandled init error:", err);
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, user, retryKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { void cleanup(); };
  }, [cleanup]);

  // ── LMS Controls ──────────────────────────────────────────────────────────

  async function handleEndClass() {
    if (!user) return;
    try { await endLiveClass(classId, user.email); } catch { /* non-fatal */ }
    await cleanup();
    router.push(dashboardPath);
  }

  async function handleLeave() {
    await cleanup();
    router.push(dashboardPath);
  }

  async function handleToggleRecording() {
    if (!session || !user) return;
    if (!isRecording) {
      try {
        const result = await startRecordingSession({ classId, title: session.title });
        recordingIdRef.current = result.recording_id;
        setIsRecording(true);
      } catch { /* non-fatal */ }
    } else {
      try {
        if (recordingIdRef.current) {
          await stopRecordingSession({ recordingId: recordingIdRef.current });
        }
        setIsRecording(false);
        recordingIdRef.current = null;
      } catch { /* non-fatal */ }
    }
  }

  if (!isAuthLoading && !user) {
    router.push("/login");
    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#0f172a" }}
    >
      {/* ── Top bar (44 px) ─────────────────────────────────────────────── */}
      <div
        style={{ height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "rgba(30,41,59,0.97)", zIndex: 10 }}
      >
        {/* Left: live dot + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {session?.title ?? "Live Classroom"}
          </span>
          {session && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#34d399", background: "rgba(52,211,153,0.15)", borderRadius: 99, padding: "2px 8px", flexShrink: 0 }}>
              LIVE
            </span>
          )}
        </div>

        {/* Right: recording + end/leave */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {isMainTeacher && session && (
            <button
              type="button"
              onClick={() => void handleToggleRecording()}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
                background: isRecording ? "#ef4444" : "#334155", color: "#f1f5f9",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: isRecording ? "#fff" : "#94a3b8" }} />
              {isRecording ? "Stop" : "Rec"}
            </button>
          )}

          {isMainTeacher ? (
            <button
              type="button"
              onClick={() => void handleEndClass()}
              style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: "#dc2626", color: "#fff" }}
            >
              End Class
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleLeave()}
              style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: "#475569", color: "#f1f5f9" }}
            >
              Leave
            </button>
          )}
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 44, left: 0, right: 0, bottom: 0 }}>

        {/* Loading state */}
        {isLoading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#0f172a" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "4px solid #10b981", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "#cbd5e1" }}>Setting up classroom…</p>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "#0f172a", padding: 32, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: "#f87171" }}>!</span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0", maxWidth: 360 }}>{error}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
              {sessionExpired ? (
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  style={{ padding: "10px 24px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "#10b981", color: "#fff" }}
                >
                  Sign In
                </button>
              ) : canRetry ? (
                <button
                  type="button"
                  onClick={handleRetry}
                  style={{ padding: "10px 24px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "#10b981", color: "#fff" }}
                >
                  Retry
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => router.push(dashboardPath)}
                style={{ padding: "10px 24px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "rgba(255,255,255,0.1)", color: "#f1f5f9" }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* ── Teacher: control panel (Jitsi is in a separate tab) ─────────── */}
        {!isLoading && !error && isTeacher && jitsiUrl && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", padding: 32 }}>
            <div style={{ maxWidth: 480, width: "100%", background: "rgba(30,41,59,0.9)", borderRadius: 20, padding: 32, border: "1px solid rgba(52,211,153,0.2)", textAlign: "center" }}>

              {/* Status indicator */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite", display: "inline-block" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#34d399", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Classroom Running
                </span>
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
                {session?.title ?? "Live Classroom"}
              </h2>
              <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 28, lineHeight: 1.6 }}>
                Your Jitsi classroom opened in a new tab.<br />
                Keep this page open to use recording controls and end the class.
              </p>

              {/* Reopen button */}
              <button
                type="button"
                onClick={() => window.open(jitsiUrl, "_blank")}
                style={{
                  width: "100%", padding: "12px 20px", borderRadius: 12, fontSize: 14,
                  fontWeight: 700, cursor: "pointer", border: "none",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "#fff", marginBottom: 12,
                }}
              >
                Open Classroom in Jitsi
              </button>

              <p style={{ fontSize: 11, color: "#64748b", marginBottom: 0 }}>
                Teacher opens the room first, then students can join.
              </p>
            </div>
          </div>
        )}

        {/* ── Student: Jitsi embedded iframe ──────────────────────────────── */}
        {!isLoading && !error && !isTeacher && jitsiUrl && (
          <iframe
            src={jitsiUrl}
            allow="camera; microphone; display-capture; autoplay; clipboard-write"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", display: "block" }}
            title="Live Classroom"
          />
        )}
      </div>
    </div>
  );
}
