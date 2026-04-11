"use client";

/**
 * LiveClassroomRoom — direct Jitsi room launch
 *
 * Instead of embedding the Jitsi External API (which was fragile across
 * browsers / mobile), we:
 *   1. Fetch the LMS class session (with auth-race-safe direct fetch + retry)
 *   2. Register presence in the LMS
 *   3. Build a stable Jitsi room URL and open it in a new tab
 *   4. Keep this page as the LMS "classroom hub" so End Class / recording
 *      controls remain accessible while the video call runs in the other tab
 *
 * Auth-race fix (preserved from previous iteration):
 *  - Direct fetch() bypasses parseResponse/clearSession() so a transient 401
 *    does not wipe the token before the retry.
 *  - isFetchingClassRef prevents concurrent fetches (React Strict Mode / retryKey).
 *  - hasInitializedRef prevents initialize() from running more than once.
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

// ─── Types & constants ───────────────────────────────────────────────────────

type Props = {
  classId: string;
  role: "teacher" | "student";
};

const JITSI_DOMAIN = (process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si").trim();

function jitsiRoomName(classId: string): string {
  return `wearekids${classId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`;
}

/**
 * Builds the direct Jitsi room URL.
 * Config overrides are passed via the URL fragment so the room opens
 * without a prejoin page and with the user's LMS display name pre-filled.
 */
function buildJitsiUrl(classId: string, displayName?: string): string {
  const room = jitsiRoomName(classId);
  const fragments: string[] = [
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    "config.p2p.enabled=false",
  ];
  if (displayName) {
    fragments.push(`userInfo.displayName=${encodeURIComponent(displayName)}`);
  }
  return `https://${JITSI_DOMAIN}/${room}#${fragments.join("&")}`;
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
  const [jitsiOpened, setJitsiOpened] = useState(false);
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
    setJitsiOpened(false);
    setJitsiUrl("");
    setIsLoading(true);
    setRetryKey((k) => k + 1);
  }

  // ── Open Jitsi room ───────────────────────────────────────────────────────

  function openJitsiRoom(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    setJitsiOpened(true);
  }

  // ── Initialization ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (isAuthLoading || !user) return;
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const currentUser = user;
    let cancelled = false;

    async function initialize() {
      // ── Guard: token must exist ─────────────────────────────────────────
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

      // ── Step 1: Fetch class session (direct fetch, no clearSession side-effect) ──
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
            // Transient 401 — retry once after 500 ms.
            // Token is still intact because we bypassed parseResponse/clearSession().
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

      // ── Step 3: Build Jitsi URL and open it ────────────────────────────
      const url = buildJitsiUrl(classId, currentUser.name);
      setJitsiUrl(url);
      setIsLoading(false);
      openJitsiRoom(url);

      // ── Step 4: Poll every 15 s — redirect when class ends ─────────────
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
        } catch { /* ignore poll errors */ }
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
    <main className="flex min-h-screen flex-col bg-slate-900">
      {/* ── LMS Header Bar ───────────────────────────────────────────────── */}
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
              {session ? `Hosted by ${session.teacher_name}` : isLoading ? "Setting up…" : ""}
            </p>
          </div>
          {session && (
            <span className="hidden shrink-0 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 sm:block">
              Live
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isMainTeacher && session && (
            <button
              type="button"
              onClick={() => void handleToggleRecording()}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                isRecording
                  ? "bg-rose-500 text-white shadow shadow-rose-900/30"
                  : "bg-slate-700 text-slate-200 hover:bg-slate-600"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isRecording ? "animate-pulse bg-white" : "bg-slate-400"}`} />
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

      {/* ── Main Area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center p-6">
        {isLoading ? (
          /* Loading state */
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="text-sm font-semibold text-slate-300">Setting up classroom…</p>
            <p className="text-xs text-slate-500">This will only take a moment</p>
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20">
              <span className="text-2xl font-bold text-rose-400">!</span>
            </div>
            <p className="max-w-sm text-sm font-medium text-slate-200">{error}</p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              {sessionExpired ? (
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  Sign In
                </button>
              ) : canRetry ? (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  Retry
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => router.push(dashboardPath)}
                className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* Classroom hub — video call is running in a separate tab */
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-8 text-center backdrop-blur-sm">
              {/* Status icon */}
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20">
                <span className="text-3xl">🎓</span>
              </div>

              <h2 className="text-lg font-semibold text-white">
                {session?.title ?? "Live Classroom"}
              </h2>
              {session && (
                <p className="mt-1 text-sm text-slate-400">
                  Hosted by {session.teacher_name}
                </p>
              )}

              {/* Room info */}
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Room
                </p>
                <p className="mt-0.5 font-mono text-sm text-emerald-400">
                  {jitsiRoomName(classId)}
                </p>
              </div>

              {/* Open / Rejoin button */}
              <button
                type="button"
                onClick={() => jitsiUrl && openJitsiRoom(jitsiUrl)}
                className="mt-5 w-full rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow shadow-emerald-900/30 hover:bg-emerald-600 active:bg-emerald-700"
              >
                {jitsiOpened ? "Rejoin Classroom" : "Open Classroom"}
              </button>

              {jitsiOpened && (
                <p className="mt-3 text-xs text-slate-500">
                  The classroom is open in another tab. Come back here to manage the session.
                </p>
              )}

              {/* Reconnect hint */}
              {!jitsiOpened && (
                <p className="mt-3 text-xs text-slate-500">
                  If the classroom did not open automatically, tap the button above.
                </p>
              )}
            </div>

            {/* Session controls card */}
            <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Session Controls
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {isMainTeacher && (
                  <button
                    type="button"
                    onClick={() => void handleToggleRecording()}
                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                      isRecording
                        ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                        : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${isRecording ? "animate-pulse bg-rose-400" : "bg-slate-500"}`} />
                    {isRecording ? "Stop Recording" : "Start Recording"}
                  </button>
                )}

                {isMainTeacher ? (
                  <button
                    type="button"
                    onClick={() => void handleEndClass()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-rose-600/20 px-4 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-600/30"
                  >
                    End Class for Everyone
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleLeave()}
                    className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-600"
                  >
                    Leave Class
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
