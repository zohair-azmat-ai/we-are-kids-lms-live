"use client";

/**
 * LiveClassroomRoom — Google Meet external video provider
 *
 * Teacher flow:
 *   1. Fetch LMS session + register presence
 *   2. "Start Class in Google Meet" button → window.open("https://meet.google.com/new", "_blank")
 *   3. Teacher pastes the generated Meet link into an input field
 *   4. Link is saved to the backend via PUT /api/v1/classes/{class_id}/meet-link
 *   5. Students polling the live class endpoint automatically receive the link
 *   6. LMS control panel stays open: End Class / Leave / recording controls
 *
 * Student flow:
 *   1. Fetch LMS session + register presence
 *   2. If meet_link is set → "Join Live Class" button → window.open(meet_link, "_blank")
 *   3. If meet_link is not yet set → "Waiting for teacher to share the meeting link…"
 *   4. Poll every 10 s — joins automatically once link appears
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
  saveMeetLink,
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
  const [retryKey, setRetryKey] = useState(0);

  // Teacher: the link they type before saving
  const [linkInput, setLinkInput] = useState("");
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [linkSaveError, setLinkSaveError] = useState("");

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
      const token = getAccessToken();
      if (!token) {
        setSessionExpired(true);
        setError("Your session has expired. Please sign in again.");
        setIsLoading(false);
        return;
      }

      if (isFetchingClassRef.current) return;
      isFetchingClassRef.current = true;

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

      if (!isTeacher && classSession.status !== "live") {
        setError("This class is not live yet. Please wait for your teacher to start.");
        setIsLoading(false);
        return;
      }

      setSession(classSession);

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
      setIsLoading(false);

      // Poll: update session (picks up meet_link once teacher saves it) + redirect when ended
      pollRef.current = setInterval(async () => {
        try {
          const resp = await fetch(`${apiBase}/api/v1/classes/${classId}`, {
            headers: { Authorization: `Bearer ${getAccessToken()}` },
            cache: "no-store",
          });
          if (resp.ok) {
            const updated = (await resp.json()) as LiveClassSession;
            setSession(updated);
            if (updated.status === "ended") {
              void cleanup();
              router.push(dashboardPath);
            }
          }
        } catch { /* ignore */ }
      }, 10_000);
    }

    void initialize().catch((err: unknown) => {
      if (!cancelled) {
        isFetchingClassRef.current = false;
        setError("Classroom failed to start. Please retry.");
        setCanRetry(true);
        setIsLoading(false);
        console.error("[LiveClassroomRoom] init error:", err);
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, user, retryKey]);

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

  async function handleSaveMeetLink() {
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("https://")) {
      setLinkSaveError("Link must start with https://");
      return;
    }
    setIsSavingLink(true);
    setLinkSaveError("");
    try {
      await saveMeetLink(classId, trimmed);
      setSession((prev) => prev ? { ...prev, meet_link: trimmed } : prev);
    } catch {
      setLinkSaveError("Failed to save link. Please try again.");
    } finally {
      setIsSavingLink(false);
    }
  }

  if (!isAuthLoading && !user) {
    router.push("/login");
    return null;
  }

  // ── Shared top bar ────────────────────────────────────────────────────────

  const topBar = (
    <div
      style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "rgba(15,23,42,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 10 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite", flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {session?.title ?? "Live Classroom"}
        </span>
        {session?.teacher_name && (
          <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
            · {session.teacher_name}
          </span>
        )}
        {session && (
          <span style={{ fontSize: 10, fontWeight: 700, color: "#34d399", background: "rgba(52,211,153,0.15)", borderRadius: 99, padding: "2px 8px", flexShrink: 0 }}>
            LIVE
          </span>
        )}
      </div>

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
  );

  // ── Error / loading overlays ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "4px solid #10b981", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#cbd5e1" }}>Setting up classroom…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", padding: 32 }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#f87171" }}>!</span>
          </div>
          <p style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 24 }}>{error}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {sessionExpired && (
              <button type="button" onClick={() => router.push("/login")} style={{ padding: "10px 24px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "#10b981", color: "#fff" }}>
                Sign In
              </button>
            )}
            {canRetry && (
              <button type="button" onClick={handleRetry} style={{ padding: "10px 24px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "#10b981", color: "#fff" }}>
                Retry
              </button>
            )}
            <button type="button" onClick={() => router.push(dashboardPath)} style={{ padding: "10px 24px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "rgba(255,255,255,0.1)", color: "#f1f5f9" }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Teacher control panel ─────────────────────────────────────────────────

  if (isTeacher && session) {
    const meetLink = session.meet_link;

    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#0f172a" }}>
        {topBar}

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflowY: "auto" }}>
          <div style={{ maxWidth: 520, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── Step 1: Open Google Meet ─────────────────────────────── */}
            <div style={{ background: "rgba(30,41,59,0.9)", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Step 1
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>
                Start your Google Meet
              </p>
              <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16, lineHeight: 1.6 }}>
                Click below to create a new meeting. Copy the link Google Meet gives you.
              </p>
              <button
                type="button"
                onClick={() => window.open("https://meet.google.com/new", "_blank")}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: "#1a73e8", color: "#fff" }}
              >
                <span style={{ fontSize: 16 }}>📹</span>
                Start Class in Google Meet
              </button>
            </div>

            {/* ── Step 2: Paste and save link ──────────────────────────── */}
            <div style={{ background: "rgba(30,41,59,0.9)", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                Step 2
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>
                Share the meeting link with students
              </p>
              <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14, lineHeight: 1.6 }}>
                Paste the Google Meet link here. Students will see a &ldquo;Join Live Class&rdquo; button immediately.
              </p>

              {meetLink ? (
                /* Link already saved */
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", marginBottom: 10 }}>
                    <span style={{ fontSize: 14 }}>✅</span>
                    <span style={{ fontSize: 13, color: "#34d399", fontWeight: 500, wordBreak: "break-all" }}>{meetLink}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setLinkInput(meetLink); setSession((p) => p ? { ...p, meet_link: null } : p); }}
                    style={{ fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    Change link
                  </button>
                </div>
              ) : (
                /* Input form */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/abc-defg-hij"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f1f5f9", outline: "none", width: "100%", boxSizing: "border-box" }}
                  />
                  {linkSaveError && (
                    <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{linkSaveError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSaveMeetLink()}
                    disabled={isSavingLink || !linkInput.trim()}
                    style={{ padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: "#10b981", color: "#fff", opacity: isSavingLink || !linkInput.trim() ? 0.6 : 1 }}
                  >
                    {isSavingLink ? "Saving…" : "Share Link with Students"}
                  </button>
                </div>
              )}
            </div>

            {/* ── Reopen button ────────────────────────────────────────── */}
            {meetLink && (
              <button
                type="button"
                onClick={() => window.open(meetLink, "_blank")}
                style={{ padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", border: "none", background: "#1a73e8", color: "#fff" }}
              >
                Rejoin Google Meet
              </button>
            )}

          </div>
        </div>
      </div>
    );
  }

  // ── Student view ──────────────────────────────────────────────────────────

  const meetLink = session?.meet_link ?? null;

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#0f172a" }}>
      {topBar}

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ maxWidth: 440, width: "100%", background: "rgba(30,41,59,0.9)", borderRadius: 20, padding: 36, border: `1px solid ${meetLink ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.07)"}`, textAlign: "center" }}>

          {/* Live badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: meetLink ? "#10b981" : "#f59e0b", animation: "pulse 2s infinite", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: meetLink ? "#34d399" : "#fbbf24" }}>
              {meetLink ? "Class is Live" : "Waiting for Link"}
            </span>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
            {session?.title ?? "Live Classroom"}
          </h2>
          {session?.teacher_name && (
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>
              {session.teacher_name} is teaching
            </p>
          )}

          {meetLink ? (
            <>
              <button
                type="button"
                onClick={() => window.open(meetLink, "_blank")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", border: "none", background: "#1a73e8", color: "#fff", boxShadow: "0 4px 24px rgba(26,115,232,0.35)" }}
              >
                <span style={{ fontSize: 18 }}>📹</span>
                Join Live Class
              </button>
              <p style={{ fontSize: 11, color: "#475569", marginTop: 14 }}>
                Opens Google Meet in a new tab
              </p>
            </>
          ) : (
            <div style={{ padding: "14px 20px", borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p style={{ fontSize: 13, color: "#fbbf24", margin: 0, lineHeight: 1.6 }}>
                Waiting for your teacher to share the meeting link…<br />
                <span style={{ fontSize: 11, color: "#92400e" }}>This page checks automatically every 10 seconds.</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
