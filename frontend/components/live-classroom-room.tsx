"use client";

/**
 * LiveClassroomRoom — direct Jitsi room launch
 *
 * Architecture
 * ────────────
 * Instead of embedding the Jitsi External API (which was fragile across
 * browsers / mobile), we:
 *   1. Fetch the LMS class session (auth-race-safe direct fetch + retry)
 *   2. Register presence in the LMS
 *   3. Request a signed JWT from the backend (moderator for main_teacher)
 *   4. Render Jitsi inside a full-page <iframe> below the LMS header bar
 *
 * Auth-race fix (preserved):
 *  - Direct fetch() bypasses parseResponse/clearSession() so a transient 401
 *    does not wipe the token before the retry.
 *  - isFetchingClassRef prevents concurrent fetches (React Strict Mode / retryKey).
 *  - hasInitializedRef prevents initialize() from running more than once.
 *
 * ── Private / Self-Hosted Jitsi (production) ──────────────────────────────
 *
 * For full moderator control (main teacher can mute/remove participants,
 * lock the room, control recording) you MUST run a private Jitsi server
 * with JWT authentication enabled.
 *
 * Role mapping:
 *   main_teacher      → "moderator"  (host — full room control)
 *   assistant_teacher → "participant" (can present; no kick/mute power)
 *   student           → "participant" (view + audio/video only)
 *
 * JWT token flow (implemented):
 *   1. After session fetch, call GET /api/v1/jitsi/token?class_id=...
 *   2. Backend verifies LMS auth, resolves moderator flag, signs JWT
 *   3. If token received → URL = https://{domain}/{room}?jwt={token}#config...
 *   4. If token=null (JITSI_APP_SECRET not set) → plain URL (dev / public mode)
 *
 * The backend sets in the JWT payload:
 *   { "context": { "user": { "moderator": true/false } }, "room": "...", ... }
 *   Signed HS256 with JITSI_APP_SECRET. Prosody/Jicofo on a private server
 *   reads context.user.moderator and grants host privileges — no login prompt.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import {
  ApiError,
  endLiveClass,
  fetchJitsiToken,
  getApiBaseUrl,
  joinClassPresence,
  leaveClassPresence,
  startRecordingSession,
  stopRecordingSession,
  type JitsiTokenResponse,
  type LiveClassSession,
} from "@/lib/api";
import { getAccessToken, isMainTeacherRole, isTeacherRole } from "@/lib/demo-auth";

// ─── Types & constants ───────────────────────────────────────────────────────

type Props = {
  classId: string;
  role: "teacher" | "student";
};

// ── Configurable Jitsi domain ──────────────────────────────────────────────
// Set NEXT_PUBLIC_JITSI_DOMAIN to your private/self-hosted Jitsi server for
// production. Defaults to meet.jit.si for development / staging.
const JITSI_DOMAIN = (process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si").trim();

// ── Room naming ────────────────────────────────────────────────────────────
// Stable per class — all roles join the same room for a given classId.
// Example: class "Class A" → "wearekidsclassa"
function jitsiRoomName(classId: string): string {
  return `wearekids${classId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`;
}

// ── Role mapping ───────────────────────────────────────────────────────────
// Maps LMS roles to Jitsi participant roles.
// On a private Jitsi server with JWT auth, this value is embedded in the
// signed token so the server enforces it. On public meet.jit.si it is
// informational only (no server enforcement).
//
//   main_teacher      → "moderator"   full room control (mute, kick, lock)
//   assistant_teacher → "participant" can present; no admin power
//   student           → "participant" audio/video, no admin power
type JitsiRole = "moderator" | "participant";

function resolveJitsiRole(lmsRole: string): JitsiRole {
  // main_teacher is the designated host / moderator.
  // assistant_teacher and student are regular participants.
  return lmsRole === "main_teacher" ? "moderator" : "participant";
}

/**
 * Builds the final Jitsi room URL from a backend-issued token response.
 *
 * If token is present (private server with JWT auth):
 *   https://{domain}/{room}?jwt={token}#config...
 *   → Prosody/Jicofo reads context.user.moderator from the JWT and grants
 *     host privileges to main_teacher automatically, no login prompt.
 *
 * If token is null (dev / public meet.jit.si, JITSI_APP_SECRET not set):
 *   https://{domain}/{room}#config...
 *   → Plain public room, no server-enforced moderator role.
 *
 * Config overrides in the fragment:
 *   - Disable prejoin page and deep-linking
 *   - Force JVB routing (required for moderator mute-all, group calls)
 *   - Enable audio processing: noise suppression, echo cancellation,
 *     automatic gain control, noisy-mic detection
 */
function buildJitsiUrlFromToken(
  tokenResponse: JitsiTokenResponse,
  displayName?: string,
): string {
  const { token, room, domain, is_moderator } = tokenResponse;

  const fragments: string[] = [
    // ── Join behaviour ───────────────────────────────────
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    // Force Video Bridge — required for groups > 2 and moderator features
    "config.p2p.enabled=false",
    // ── Audio / noise reduction ──────────────────────────
    // Keep all audio processing pipelines enabled for clean sound.
    // These are Jitsi's built-in Webkit/browser AudioWorklet processors.
    "config.disableAP=false",      // Audio Processing — master switch
    "config.disableNS=false",      // Noise Suppression
    "config.disableAEC=false",     // Acoustic Echo Cancellation
    "config.disableAGC=false",     // Automatic Gain Control
    "config.enableNoisyMicDetection=true",  // Warn user if mic is noisy
  ];

  if (displayName) {
    fragments.push(`userInfo.displayName=${encodeURIComponent(displayName)}`);
  }

  const fragment = fragments.join("&");

  if (typeof window !== "undefined") {
    console.log(
      `[Jitsi] Opening room "${room}" on "${domain}" | moderator=${is_moderator} | jwt=${token ? "present" : "none (dev mode)"}`,
    );
  }

  // JWT present → append as query param so private server can enforce roles
  if (token) {
    return `https://${domain}/${room}?jwt=${token}#${fragment}`;
  }

  // No JWT → plain URL (public meet.jit.si or private server without JWT auth)
  return `https://${domain}/${room}#${fragment}`;
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

      // ── Step 3: Request Jitsi token from backend ───────────────────────
      // The backend verifies LMS auth, resolves the moderator flag
      // (main_teacher → moderator=true, everyone else → false), and signs
      // a JWT with JITSI_APP_SECRET if configured.
      //
      // On a private Jitsi server: the signed JWT is appended as ?jwt=...
      // so Prosody/Jicofo grants host privileges to main_teacher automatically.
      //
      // On public meet.jit.si / no JITSI_APP_SECRET: token=null is returned
      // and the frontend falls back to a plain room URL (dev mode).
      let jitsiTokenData: JitsiTokenResponse;
      try {
        jitsiTokenData = await fetchJitsiToken(classId);
        console.log(
          `[LiveClassroomRoom] Jitsi token fetched — moderator=${jitsiTokenData.is_moderator} jwt=${jitsiTokenData.token ? "yes" : "no"}`,
        );
      } catch (tokenErr) {
        // Non-fatal: fall back to a plain public URL without JWT
        console.warn("[LiveClassroomRoom] Jitsi token fetch failed, falling back to plain URL:", tokenErr);
        jitsiTokenData = {
          token: null,
          room: jitsiRoomName(classId),
          domain: JITSI_DOMAIN,
          is_moderator: isMainTeacher,
        };
      }

      if (cancelled) return;

      const url = buildJitsiUrlFromToken(jitsiTokenData, currentUser.name);
      setJitsiUrl(url);
      setIsLoading(false);

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
              {session
                ? `Hosted by ${session.teacher_name}`
                : isLoading
                  ? "Setting up classroom…"
                  : ""}
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

      {/* ── Video area — fills remaining screen height ───────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-900">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="text-sm font-semibold text-slate-300">Setting up classroom…</p>
            <p className="text-xs text-slate-500">This will only take a moment</p>
          </div>
        )}

        {/* Error overlay */}
        {!isLoading && error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-slate-900 p-8 text-center">
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
        )}

        {/* Jitsi iframe — rendered inline inside the LMS page, no new tab */}
        {jitsiUrl && (
          <iframe
            src={jitsiUrl}
            allow="camera; microphone; display-capture; autoplay; clipboard-write"
            className="h-full w-full border-0"
            title="Live Classroom"
          />
        )}
      </div>
    </main>
  );
}
