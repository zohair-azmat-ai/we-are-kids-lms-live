"use client";

/**
 * LiveClassroomRoom — Jitsi Meet integration
 *
 * Replaces the previous LiveKit-based implementation with a Jitsi Meet
 * embed using the Jitsi External API.  All LMS-side features (session
 * lifecycle, attendance presence, role controls, recording metadata) are
 * preserved; the video/audio call is delegated entirely to Jitsi for
 * stable group calling.
 *
 * Room naming: wearekids<classId-alphanum>  (e.g. wearekidsabc123)
 * Domain:      NEXT_PUBLIC_JITSI_DOMAIN (default: meet.jit.si)
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
  interfaceConfigOverwrite?: Record<string, unknown>;
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

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  classId: string;
  /** "teacher" for the teacher classroom page, "student" for the student page */
  role: "teacher" | "student";
};

const JITSI_DOMAIN = (process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si").trim();

/** Produces a stable, URL-safe Jitsi room name from the LMS class ID. */
function jitsiRoomName(classId: string): string {
  return `wearekids${classId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`;
}

/** Dynamically loads the Jitsi External API script (idempotent). */
function loadJitsiScript(domain: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }
    const existing = document.getElementById("jitsi-external-api");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "jitsi-external-api";
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load video call. Please check your connection."));
    document.head.appendChild(script);
  });
}

export function LiveClassroomRoom({ classId, role }: Props) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [session, setSession] = useState<LiveClassSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<JitsiMeetAPI | null>(null);
  const hasInitializedRef = useRef(false);
  const recordingIdRef = useRef<string | null>(null);
  const presenceJoinedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive roles from auth (user.role is the authoritative source)
  const isTeacher = user ? isTeacherRole(user.role) : role === "teacher";
  const isMainTeacher = user ? isMainTeacherRole(user.role) : false;
  const dashboardPath = isTeacher ? "/teacher/dashboard" : "/student/dashboard";

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = useCallback(async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (jitsiApiRef.current) {
      try {
        jitsiApiRef.current.dispose();
      } catch {
        /* ignore dispose errors */
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

  // ── Initialization ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (isAuthLoading || !user) return;
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Capture user as a local const so TypeScript can narrow it inside
    // the inner async function (closures don't inherit the outer narrowing).
    const currentUser = user;
    let cancelled = false;

    async function initialize() {
      // Fetch the LMS class session
      let classSession: LiveClassSession;
      try {
        classSession = await fetchClassSession(classId);
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

      // Load the Jitsi External API script
      try {
        await loadJitsiScript(JITSI_DOMAIN);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Video call failed to load.");
          setIsLoading(false);
        }
        return;
      }

      if (cancelled || !jitsiContainerRef.current) return;

      if (!window.JitsiMeetExternalAPI) {
        if (!cancelled) {
          setError("Video calling is unavailable. Please refresh and try again.");
          setIsLoading(false);
        }
        return;
      }

      // Poll session every 15 s — redirect when the class ends
      pollRef.current = setInterval(async () => {
        try {
          const updated = await fetchClassSession(classId);
          if (updated.status === "ended") {
            void cleanup();
            router.push(dashboardPath);
          }
        } catch {
          /* ignore poll errors */
        }
      }, 15_000);

      // Build Jitsi toolbar based on role
      const toolbarButtons = [
        "microphone",
        "camera",
        "chat",
        "desktop",
        "fullscreen",
        "tileview",
        "hangup",
        ...(isMainTeacher ? ["mute-everyone", "security"] : []),
      ];

      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: jitsiRoomName(classId),
        width: "100%",
        height: "100%",
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: currentUser.name,
          email: currentUser.email,
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          // Skip the pre-join lobby screen — everyone gets in immediately
          prejoinPageEnabled: false,
          enableLobbyChat: false,
          requireDisplayName: false,
          enableWelcomePage: false,
          subject: classSession.title,
          toolbarButtons,
          // Force JVB (Jitsi Video Bridge) instead of P2P so group calls
          // are routed through a stable media server — this is the main fix
          // for the previous "assistant/student can't see teacher" issue.
          p2p: { enabled: false },
          startBitrate: 800,
          channelLastN: 20,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          BRAND_WATERMARK_LINK: "",
          DEFAULT_REMOTE_DISPLAY_NAME: "Participant",
          APP_NAME: "We Are Kids LMS",
          NATIVE_APP_NAME: "We Are Kids LMS",
          PROVIDER_NAME: "We Are Kids",
          HIDE_INVITE_MORE_HEADER: true,
        },
      });

      jitsiApiRef.current = api;

      api.addEventListeners({
        videoConferenceJoined: () => {
          if (!cancelled) {
            setIsLoading(false);
          }
        },
        videoConferenceLeft: () => {
          void cleanup();
          router.push(dashboardPath);
        },
        readyToClose: () => {
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
        setError("Classroom failed to start. Please refresh and try again.");
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, user]);

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
      /* non-fatal — cleanup regardless */
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

  // ── Redirect unauthenticated users ────────────────────────────────────────

  if (!isAuthLoading && !user) {
    router.push("/login");
    return null;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="flex h-screen flex-col bg-slate-900">
      {/* ── LMS Header Bar ─────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-3 bg-slate-800/95 px-4 py-2.5 backdrop-blur-sm sm:px-6">
        {/* Class info */}
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

        {/* Role-based controls */}
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
            <button
              type="button"
              onClick={() => router.push(dashboardPath)}
              className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Jitsi iframe mounts here */}
        <div ref={jitsiContainerRef} className="h-full w-full" />
      </div>
    </main>
  );
}
