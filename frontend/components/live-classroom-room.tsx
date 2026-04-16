"use client";

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
  uploadRecording,
  type LiveClassSession,
} from "@/lib/api";
import { getAccessToken, isMainTeacherRole, isTeacherRole } from "@/lib/demo-auth";
import VideoClassroom from "@/components/video-classroom";

// idle → starting → recording → stopping → uploading → idle
//                             ↘ error → idle
type RecordingState = "idle" | "starting" | "recording" | "stopping" | "uploading" | "error";

type Props = {
  classId: string;
  role: "teacher" | "student";
};

export function LiveClassroomRoom({ classId, role }: Props) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [session, setSession] = useState<LiveClassSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const hasInitializedRef = useRef(false);
  const isFetchingClassRef = useRef(false);
  const recordingIdRef = useRef<string | null>(null);
  const presenceJoinedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const isTeacher = user ? isTeacherRole(user.role) : role === "teacher";
  const isMainTeacher = user ? isMainTeacherRole(user.role) : false;
  const dashboardPath = isTeacher ? "/teacher/dashboard" : "/student/dashboard";

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

  function handleRetry() {
    hasInitializedRef.current = false;
    isFetchingClassRef.current = false;
    setError("");
    setCanRetry(false);
    setSessionExpired(false);
    setIsLoading(true);
    setRetryKey((k) => k + 1);
  }

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
          if (fetchErr instanceof ApiError && (fetchErr as ApiError).status === 401) {
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

  function showRecordingError(msg: string) {
    setRecordingState("error");
    setRecordingError(msg);
    setTimeout(() => {
      setRecordingState("idle");
      setRecordingError(null);
    }, 3500);
  }

  async function handleToggleRecording() {
    if (!session || !user) return;
    if (recordingState === "starting" || recordingState === "stopping" || recordingState === "uploading") return;

    if (recordingState === "idle" || recordingState === "error") {
      // ── START RECORDING ────────────────────────────────────────────
      console.log("[Recording] Recording button clicked — starting for class:", classId);
      // Optimistic: switch to "starting" immediately so UI responds on first tap
      setRecordingState("starting");
      setRecordingError(null);

      // 1. Request screen capture (hints to share the current browser tab)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" } as MediaTrackConstraints,
          audio: true,
        });
      } catch (err) {
        console.warn("[Recording] getDisplayMedia denied or unsupported:", err);
        showRecordingError("Screen capture denied.");
        return;
      }
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      // 2. Create DB entry (optimistic — UI already shows "starting")
      console.log("[Recording] Recording start request sent");
      let recordingId: string;
      try {
        const result = await startRecordingSession({ classId, title: session.title });
        recordingId = result.recording_id;
        recordingIdRef.current = recordingId;
        console.log("[Recording] Recording start success — id:", recordingId);
      } catch (err) {
        console.error("[Recording] Recording error — failed to create DB entry:", err);
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        showRecordingError("Failed to start recording.");
        return;
      }

      // 3. Pick best supported mimeType
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const chunks = recordedChunksRef.current;
        const id = recordingIdRef.current;
        const sess = session;
        const usr = user;

        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;

        setRecordingState("uploading");
        console.log("[Recording] Recording stop success — uploading…");

        try {
          if (chunks.length === 0 || !id) {
            console.warn("[Recording] No chunks or missing id — skipping upload.");
            setRecordingState("idle");
            return;
          }
          const blob = new Blob(chunks, { type: mimeType || "video/webm" });
          const file = new File([blob], `recording-${id}.webm`, { type: blob.type });
          console.log("[Recording] Uploading blob — size:", blob.size, "bytes, recording_id:", id);

          const result = await uploadRecording({
            classId,
            teacherName: usr.name,
            title: sess?.title ?? "Class Recording",
            file,
            recordingId: id,
          });
          console.log("[Recording] Upload complete — cloud_url:", result.cloud_url, "status:", result.status);
          recordingIdRef.current = null;
          recordedChunksRef.current = [];
        } catch (err) {
          console.error("[Recording] Recording error — upload failed:", err);
        } finally {
          setRecordingState("idle");
        }
      };

      // Handle user stopping share via browser's native stop button
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      });

      recorder.start(5000);
      setRecordingState("recording");
    } else {
      // ── STOP RECORDING ─────────────────────────────────────────────
      console.log("[Recording] Stop recording clicked");
      setRecordingState("stopping");
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop(); // triggers onstop → uploading → idle
      } else {
        setRecordingState("idle");
      }
    }
  }

  if (!isAuthLoading && !user) {
    router.push("/login");
    return null;
  }

  const isRecActive = recordingState === "recording";
  const isRecBusy = recordingState === "starting" || recordingState === "stopping" || recordingState === "uploading";
  const recButtonDisabled = isRecBusy;

  const recButtonLabel =
    recordingState === "starting"  ? "Starting…" :
    recordingState === "recording" ? "Stop REC"  :
    recordingState === "stopping"  ? "Stopping…" :
    recordingState === "uploading" ? "Saving…"   :
    recordingState === "error"     ? "Error"      :
    "REC";

  const recButtonBg =
    recordingState === "recording" ? "rgba(239,68,68,0.18)" :
    recordingState === "uploading" ? "rgba(124,58,237,0.18)" :
    recordingState === "error"     ? "rgba(239,68,68,0.12)" :
    "rgba(255,255,255,0.06)";

  const recButtonBorder =
    recordingState === "recording" ? "1px solid rgba(239,68,68,0.5)" :
    recordingState === "uploading" ? "1px solid rgba(124,58,237,0.4)" :
    recordingState === "error"     ? "1px solid rgba(239,68,68,0.35)" :
    "1px solid rgba(255,255,255,0.1)";

  const topBar = (
    <>
      {/* Keyframe injection for blinking dot */}
      <style>{`
        @keyframes rec-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes cls-spin  { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{
        height: 52, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px", gap: 8,
        background: "rgba(15,23,42,0.98)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        zIndex: 10,
      }}>
        {/* ── Left: title + badges ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          {/* LIVE badge */}
          {session && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
              color: "#34d399",
              background: "rgba(52,211,153,0.10)",
              border: "1px solid rgba(52,211,153,0.30)",
              borderRadius: 99, padding: "3px 8px", flexShrink: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "rec-blink 2s ease-in-out infinite" }} />
              LIVE
            </span>
          )}

          {/* REC badge — visible while recording/stopping/uploading */}
          {(isRecActive || isRecBusy) && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
              color: recordingState === "uploading" ? "#a78bfa" : "#f87171",
              background: recordingState === "uploading" ? "rgba(124,58,237,0.15)" : "rgba(239,68,68,0.15)",
              border: recordingState === "uploading" ? "1px solid rgba(124,58,237,0.35)" : "1px solid rgba(239,68,68,0.40)",
              borderRadius: 99, padding: "3px 8px", flexShrink: 0,
            }}>
              {recordingState === "uploading"
                ? <span style={{ width: 7, height: 7, borderRadius: "50%", border: "2px solid #a78bfa", borderTopColor: "transparent", animation: "cls-spin 0.7s linear infinite" }} />
                : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: isRecActive ? "rec-blink 1s ease-in-out infinite" : "none" }} />
              }
              {recordingState === "uploading" ? "SAVING" : "REC"}
            </span>
          )}

          {/* Error badge */}
          {recordingState === "error" && recordingError && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: "#fca5a5",
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 99, padding: "3px 8px", flexShrink: 0,
            }}>
              {recordingError}
            </span>
          )}

          {/* Session title */}
          <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {session?.title ?? "Live Classroom"}
          </span>

          {session?.teacher_name && (
            <span style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap", flexShrink: 0 }}>
              · {session.teacher_name}
            </span>
          )}
        </div>

        {/* ── Right: controls ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {isMainTeacher && session && (
            <button
              type="button"
              onClick={() => void handleToggleRecording()}
              disabled={recButtonDisabled}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "6px 11px", borderRadius: 8,
                fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
                cursor: recButtonDisabled ? "default" : "pointer",
                border: recButtonBorder,
                background: recButtonBg,
                color: recordingState === "recording" ? "#fca5a5"
                     : recordingState === "uploading"  ? "#c4b5fd"
                     : recordingState === "error"       ? "#fca5a5"
                     : "#cbd5e1",
                opacity: recButtonDisabled ? 0.7 : 1,
                transition: "background 0.15s, border 0.15s, color 0.15s",
                minWidth: 72, justifyContent: "center",
                // Large tap target on mobile
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* Blinking dot inside button when recording */}
              {isRecActive && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0, animation: "rec-blink 1s ease-in-out infinite" }} />
              )}
              {recordingState === "starting" && (
                <span style={{ width: 7, height: 7, borderRadius: "50%", border: "2px solid #94a3b8", borderTopColor: "transparent", flexShrink: 0, animation: "cls-spin 0.7s linear infinite" }} />
              )}
              {recButtonLabel}
            </button>
          )}

          {isMainTeacher ? (
            <button
              type="button"
              onClick={() => void handleEndClass()}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                cursor: "pointer", border: "1px solid rgba(220,38,38,0.5)",
                background: "rgba(220,38,38,0.15)", color: "#fca5a5",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              End Class
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleLeave()}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.06)", color: "#94a3b8",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Leave
            </button>
          )}
        </div>
      </div>
    </>
  );

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

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#0f172a" }}>
      {topBar}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <VideoClassroom
          classId={classId}
          userName={user?.name}
          isTeacher={isTeacher}
          onLeave={() => void handleLeave()}
        />
      </div>
    </div>
  );
}
