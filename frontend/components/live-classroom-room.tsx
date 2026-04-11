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
  //
  // Layout strategy (mobile-safe):
  //   • Root <div> is position:fixed, covers 100% of the viewport — avoids
  //     the broken 100vh / mobile browser-chrome shrink issue entirely.
  //   • Minimal top bar: fixed height 44px, contains only essential controls.
  //   • Jitsi <iframe> fills the remaining space via
  //     position:absolute + top:44px + bottom:0 — no overflow clipping.
  //   • Loading / error states use the same absolute overlay so they never
  //     push content or break the layout.
  //   • No card wrappers, no padding sections, no constrained containers.

  return (
    // Full-viewport fixed container — immune to mobile address-bar resize
    <div
      style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#0f172a" }}
    >
      {/* ── Minimal top bar (44 px) ─────────────────────────────────────── */}
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

      {/* ── Call area — absolute, fills everything below the top bar ────── */}
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

        {/* Jitsi iframe — full area, no clipping */}
        {jitsiUrl && (
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
