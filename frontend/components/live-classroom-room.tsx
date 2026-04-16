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
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
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

  async function handleToggleRecording() {
    if (!session || !user) return;

    if (!isRecording) {
      // ── START RECORDING ────────────────────────────────────────────
      console.log("[Recording] Starting recording for class:", classId);

      // 1. Request screen capture (hints to share the current browser tab)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" } as MediaTrackConstraints,
          audio: true,
        });
      } catch (err) {
        console.warn("[Recording] getDisplayMedia denied or unsupported:", err);
        return;
      }
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      // 2. Create DB entry first so recording is visible immediately
      let recordingId: string;
      try {
        const result = await startRecordingSession({ classId, title: session.title });
        recordingId = result.recording_id;
        recordingIdRef.current = recordingId;
        console.log("[Recording] Recording started — id:", recordingId);
      } catch (err) {
        console.error("[Recording] Failed to create DB entry:", err);
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        return;
      }

      // 3. Start MediaRecorder
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
        console.log("[Recording] MediaRecorder stopped — uploading...");
        const chunks = recordedChunksRef.current;
        const id = recordingIdRef.current;
        const sess = session;
        const usr = user;

        // Stop all tracks
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;

        setIsRecording(false);
        setIsUploadingRecording(true);

        try {
          if (chunks.length === 0 || !id) {
            console.warn("[Recording] No chunks recorded or missing id — skipping upload.");
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
          console.error("[Recording] Upload failed:", err);
        } finally {
          setIsUploadingRecording(false);
        }
      };

      // If the user stops sharing via the browser's native stop button, clean up
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      });

      recorder.start(5000); // collect chunks every 5 s
      setIsRecording(true);
    } else {
      // ── STOP RECORDING ─────────────────────────────────────────────
      console.log("[Recording] Stopping recording...");
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop(); // triggers onstop which handles upload
      } else {
        setIsRecording(false);
      }
    }
  }

  if (!isAuthLoading && !user) {
    router.push("/login");
    return null;
  }

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
            disabled={isUploadingRecording}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              cursor: isUploadingRecording ? "default" : "pointer", border: "none",
              background: isUploadingRecording ? "#7c3aed" : isRecording ? "#ef4444" : "#334155",
              color: "#f1f5f9", opacity: isUploadingRecording ? 0.8 : 1,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isUploadingRecording ? "#c4b5fd" : isRecording ? "#fff" : "#94a3b8" }} />
            {isUploadingRecording ? "Saving…" : isRecording ? "Stop" : "Rec"}
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
