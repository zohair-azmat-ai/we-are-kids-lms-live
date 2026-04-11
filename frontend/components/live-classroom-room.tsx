"use client";

/**
 * LiveClassroomRoom — Jitsi Meet integration
 *
 * Fixes for mobile (Safari + Chrome):
 *  - loadJitsiScript: poll for window.JitsiMeetExternalAPI when the
 *    script tag already exists (avoids "load" event miss on re-mount)
 *  - 10-second join timeout: if videoConferenceJoined never fires,
 *    show "Unable to join" error with a Retry button
 *  - Minimal configOverwrite: removes deprecated interfaceConfigOverwrite
 *    and complex keys that break mobile init
 *  - Debug logs throughout initialization flow
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import {
  endLiveClass,
  fetchClassSession,
  joinClassPresence,
  leaveClassPresence,
  startRecordingSession,
  stopRecordingSession,
  type LiveClassSession,
} from "@/lib/api";
import { isMainTeacherRole, isTeacherRole } from "@/lib/demo-auth";

// ─── Jitsi External API types (loaded via <script> at runtime) ──────────────

interface JitsiMeetOptions {
  roomName: string;
  width: string | number;
  height: string | number;
  parentNode: HTMLElement;
  userInfo?: { displayName: string; email?: string };
  configOverwrite?: Record<string, unknown>;
}

interface JitsiMeetAPI {
  executeCommand(command: string, ...args: unknown[]): void;
  addEventListeners(listeners: Record<string, (...args: unknown[]) => void>): void;
  dispose(): void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: JitsiMeetOptions) => JitsiMeetAPI;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Props = {
  classId: string;
  role: "teacher" | "student";
};

const JITSI_DOMAIN = (process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si").trim();

function jitsiRoomName(classId: string): string {
  return `wearekids${classId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`;
}

/**
 * Loads the Jitsi External API script with a polling fallback.
 *
 * The bug this fixes: if the <script> tag already exists in the DOM
 * (React Strict Mode double-invoke, hot-reload) but hasn't finished
 * loading yet, the "load" event has already fired and a new listener
 * will never resolve. We poll window.JitsiMeetExternalAPI instead.
 */
function loadJitsiScript(domain: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded — fast path
    if (typeof window !== "undefined" && window.JitsiMeetExternalAPI) {
      console.log("[Jitsi] Script already loaded (fast path)");
      resolve();
      return;
    }

    const scriptId = "jitsi-external-api";

    function startPolling() {
      console.log("[Jitsi] Polling for window.JitsiMeetExternalAPI…");
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 150;
        if (window.JitsiMeetExternalAPI) {
          clearInterval(interval);
          console.log("[Jitsi] Script loaded (polled)");
          resolve();
        } else if (elapsed >= 12_000) {
          clearInterval(interval);
          reject(new Error("Jitsi script did not load in time. Please check your connection."));
        }
      }, 150);
    }

    const existing = document.getElementById(scriptId);
    if (existing) {
      // Script tag is in the DOM — may or may not have loaded yet.
      // Poll instead of relying on a "load" event that may have already fired.
      startPolling();
      return;
    }

    // Inject the script tag for the first time
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => {
      console.log("[Jitsi] Script loaded (onload)");
      resolve();
    };
    script.onerror = () => {
      reject(new Error("Failed to load video call. Please check your connection."));
    };
    document.head.appendChild(script);
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LiveClassroomRoom({ classId, role }: Props) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [session, setSession] = useState<LiveClassSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<JitsiMeetAPI | null>(null);
  const hasInitializedRef = useRef(false);
  const recordingIdRef = useRef<string | null>(null);
  const presenceJoinedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTeacher = user ? isTeacherRole(user.role) : role === "teacher";
  const isMainTeacher = user ? isMainTeacherRole(user.role) : false;
  const dashboardPath = isTeacher ? "/teacher/dashboard" : "/student/dashboard";

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = useCallback(async () => {
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.dispose();
      } catch {
        /* ignore */
      }
      jitsiApiRef.current = null;
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
      } catch {
        /* non-fatal */
      }
    }
  }, [classId, user, isTeacher]);

  // ── Retry ─────────────────────────────────────────────────────────────────

  function handleRetry() {
    console.log("[LiveClassroomRoom] Retry requested");
    if (jitsiApiRef.current) {
      try { jitsiApiRef.current.dispose(); } catch { /* ignore */ }
      jitsiApiRef.current = null;
    }
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
    hasInitializedRef.current = false;
    setError("");
    setCanRetry(false);
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
      console.log("[LiveClassroomRoom] Initializing classId:", classId);

      // Step 1 — Fetch LMS session
      let classSession: LiveClassSession;
      try {
        classSession = await fetchClassSession(classId);
        console.log("[LiveClassroomRoom] Session status:", classSession.status);
      } catch {
        if (!cancelled) {
          setError("Unable to load classroom. Please return to your dashboard.");
          setIsLoading(false);
        }
        return;
      }

      if (cancelled) return;

      // Students can only join a live session
      if (!isTeacher && classSession.status !== "live") {
        setError("This class is not live yet. Please wait for your teacher to start.");
        setIsLoading(false);
        return;
      }

      setSession(classSession);

      // Register LMS presence (non-fatal)
      try {
        await joinClassPresence({
          classId,
          role: isTeacher ? "teacher" : "student",
          participantEmail: currentUser.email,
          participantName: currentUser.name,
        });
        presenceJoinedRef.current = true;
      } catch {
        /* non-fatal */
      }

      if (cancelled) return;

      // Step 2 — Load Jitsi External API script
      console.log("[LiveClassroomRoom] Loading Jitsi script from:", JITSI_DOMAIN);
      try {
        await loadJitsiScript(JITSI_DOMAIN);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Video call failed to load.");
          setCanRetry(true);
          setIsLoading(false);
        }
        return;
      }

      if (cancelled || !jitsiContainerRef.current) return;

      if (!window.JitsiMeetExternalAPI) {
        if (!cancelled) {
          setError("Video calling is unavailable. Please refresh and try again.");
          setCanRetry(true);
          setIsLoading(false);
        }
        return;
      }

      // Poll session every 15 s — redirect when class ends
      pollRef.current = setInterval(async () => {
        try {
          const updated = await fetchClassSession(classId);
          if (updated.status === "ended") {
            void cleanup();
            router.push(dashboardPath);
          }
        } catch {
          /* ignore */
        }
      }, 15_000);

      // Step 3 — Create Jitsi instance with minimal mobile-safe config
      console.log("[LiveClassroomRoom] Creating Jitsi instance, room:", jitsiRoomName(classId));

      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: jitsiRoomName(classId),
        width: "100%",
        height: "100%",
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: currentUser.name,
          email: currentUser.email,
        },
        // Minimal config — heavy overrides break mobile Safari init.
        // p2p disabled for stable group calls (JVB routing).
        // disableDeepLinking prevents mobile "open in app" intercept.
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          p2p: { enabled: false },
        },
      });

      console.log("[LiveClassroomRoom] Jitsi API ready, waiting for join…");
      jitsiApiRef.current = api;

      // 10-second failsafe — show retry if videoConferenceJoined never fires
      joinTimeoutRef.current = setTimeout(() => {
        if (!cancelled) {
          console.warn("[Jitsi] Join timeout — videoConferenceJoined never fired");
          setError("Unable to join classroom. Please retry.");
          setCanRetry(true);
          setIsLoading(false);
        }
      }, 10_000);

      api.addEventListeners({
        videoConferenceJoined: () => {
          console.log("[Jitsi] Join success — videoConferenceJoined");
          if (joinTimeoutRef.current) {
            clearTimeout(joinTimeoutRef.current);
            joinTimeoutRef.current = null;
          }
          if (!cancelled) {
            setIsLoading(false);
          }
        },
        videoConferenceLeft: () => {
          console.log("[Jitsi] Conference left");
          void cleanup();
          router.push(dashboardPath);
        },
        readyToClose: () => {
          console.log("[Jitsi] Ready to close");
          void cleanup();
          router.push(dashboardPath);
        },
        errorOccurred: (data: unknown) => {
          console.warn("[Jitsi] Error event:", data);
        },
      });
    }

    void initialize().catch((err: unknown) => {
      if (!cancelled) {
        console.error("[LiveClassroomRoom] Unhandled init error:", err);
        setError("Classroom failed to start. Please retry.");
        setCanRetry(true);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // retryKey is intentionally in deps to allow the retry flow to re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, user, retryKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  // ── LMS Controls ──────────────────────────────────────────────────────────

  async function handleEndClass() {
    if (!user) return;
    try {
      await endLiveClass(classId, user.email);
    } catch {
      /* non-fatal */
    }
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
      } catch {
        /* non-fatal */
      }
    } else {
      try {
        if (recordingIdRef.current) {
          await stopRecordingSession({ recordingId: recordingIdRef.current });
        }
        setIsRecording(false);
        recordingIdRef.current = null;
      } catch {
        /* non-fatal */
      }
    }
  }

  if (!isAuthLoading && !user) {
    router.push("/login");
    return null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="flex h-screen flex-col bg-slate-900">
      {/* ── LMS Header Bar ─────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-3 bg-slate-800/95 px-4 py-2.5 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow shadow-emerald-900/40">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {session?.title ?? "Live Classroom"}
            </p>
            <p className="truncate text-xs text-slate-400">
              {session ? `Hosted by ${session.teacher_name}` : "Connecting…"}
            </p>
          </div>
          {session && (
            <span className="hidden shrink-0 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 sm:block">
              Live
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isMainTeacher && (
            <button
              type="button"
              onClick={() => void handleToggleRecording()}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                isRecording
                  ? "bg-rose-500 text-white shadow shadow-rose-900/30"
                  : "bg-slate-700 text-slate-200 hover:bg-slate-600"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isRecording ? "animate-pulse bg-white" : "bg-slate-400"
                }`}
              />
              <span className="hidden sm:inline">
                {isRecording ? "Stop Recording" : "Record"}
              </span>
            </button>
          )}

          {isMainTeacher ? (
            <button
              type="button"
              onClick={() => void handleEndClass()}
              className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow shadow-rose-900/30 hover:bg-rose-700"
            >
              End Class
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleLeave()}
              className="rounded-xl bg-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-500"
            >
              Leave
            </button>
          )}
        </div>
      </header>

      {/* ── Video Call Area ─────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Loading overlay */}
        {isLoading && !error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-900">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="text-sm font-semibold text-slate-300">Connecting to classroom…</p>
            <p className="text-xs text-slate-500">Setting up your video call</p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-slate-900 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20">
              <span className="text-2xl font-bold text-rose-400">!</span>
            </div>
            <p className="max-w-sm text-sm font-medium text-slate-200">{error}</p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              {canRetry && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  Retry Classroom
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push(dashboardPath)}
                className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Jitsi iframe mounts here — always in DOM so Jitsi can attach */}
        <div ref={jitsiContainerRef} className="h-full w-full" />
      </div>
    </main>
  );
}
