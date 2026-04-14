"use client";

import { useEffect, useRef, useState } from "react";
import type { IAgoraRTCClient, IAgoraRTCRemoteUser, IRemoteVideoTrack, IRemoteAudioTrack } from "agora-rtc-sdk-ng";
import { fetchAgoraToken } from "@/lib/api";

// Build-time constant — Next.js inlines NEXT_PUBLIC_* at compile time.
const APP_ID = (process.env.NEXT_PUBLIC_AGORA_APP_ID || "").trim();

interface AgoraClassroomProps {
  classId: string;
  onLeave?: () => void;
}

interface RemoteUser {
  uid: string | number;
  videoTrack: IRemoteVideoTrack | null;
  audioTrack: IRemoteAudioTrack | null;
}

function RemoteUserTile({ user }: { user: RemoteUser }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user.videoTrack && ref.current) {
      user.videoTrack.play(ref.current);
    }
    return () => {
      user.videoTrack?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.videoTrack]);

  useEffect(() => {
    if (user.audioTrack) {
      user.audioTrack.play();
    }
    return () => {
      user.audioTrack?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.audioTrack]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
      <div ref={ref} className="w-full h-full" />
      {!user.videoTrack && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-white text-2xl">
            👤
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgoraClassroom({ classId, onLeave }: AgoraClassroomProps) {
  const localVideoRef = useRef<HTMLDivElement>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  // Generate a concrete non-zero numeric UID once per session.
  // This is stored in a ref so it never changes across re-renders.
  // The SAME uid is sent to the backend for token generation AND used in client.join()
  // to guarantee a perfect match — resolving the uid=0/null mismatch that caused
  // "CAN_NOT_GET_GATEWAY_SERVER / dynamic key or token timeout".
  const sessionUidRef = useRef<number>(Math.floor(Math.random() * 999_999_999) + 1);

  // Refs to hold Agora objects for cleanup
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<{ close: () => void; play: (el: HTMLElement) => void; setEnabled: (v: boolean) => Promise<void> } | null>(null);
  const localAudioTrackRef = useRef<{ close: () => void; setEnabled: (v: boolean) => Promise<void> } | null>(null);

  // Channel name: strip all non-alphanumeric chars from classId to satisfy Agora naming rules
  const channelName = `wearekids${classId.replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    let cancelled = false;
    const sessionUid = sessionUidRef.current;

    async function join() {
      try {
        console.log("[Agora] Loading SDK...");
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;

        // --- appId source of truth: module-level APP_ID constant ---
        const envAppId = APP_ID;
        console.log("[Agora] APP_ID (build-time) —", {
          value: envAppId,
          length: envAppId.length,
          set: envAppId.length > 0,
        });

        // Fetch token using the EXACT same uid we will pass to client.join()
        console.log("[Agora] Requesting token — channel:", channelName, "uid:", sessionUid);
        const tokenResp = await fetchAgoraToken(channelName, sessionUid);
        const backendAppId = (tokenResp.appId ?? "").trim();
        console.log("[Agora] Token response —", {
          backendAppId,
          backendAppId_length: backendAppId.length,
          channel: tokenResp.channel,
          uid: tokenResp.uid,
          token_prefix: tokenResp.token.slice(0, 12) + "…",
        });

        // --- Validate appId sources agree ---
        if (envAppId.length === 0) {
          throw new Error(
            `[Agora] NEXT_PUBLIC_AGORA_APP_ID is empty — set this env var in Vercel/local .env.local`,
          );
        }
        if (backendAppId.length === 0) {
          throw new Error(
            `[Agora] Backend returned empty appId — check AGORA_APP_ID env var on the backend`,
          );
        }
        if (envAppId !== backendAppId) {
          throw new Error(
            `[Agora] appId MISMATCH — env="${envAppId}" (len=${envAppId.length}) vs backend="${backendAppId}" (len=${backendAppId.length})`,
          );
        }

        // Single validated appId used for everything below
        const joinAppId = backendAppId;
        console.log("[Agora] appId validated — using joinAppId:", joinAppId, "length:", joinAppId.length);

        if (cancelled) return;

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;

        client.on("user-published", async (remoteUser: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
          console.log("[Agora] Remote user published:", remoteUser.uid, mediaType);
          await client.subscribe(remoteUser, mediaType);

          setRemoteUsers((prev) => {
            const existing = prev.find((u) => u.uid === remoteUser.uid);
            if (existing) {
              return prev.map((u) =>
                u.uid === remoteUser.uid
                  ? {
                      ...u,
                      videoTrack: mediaType === "video" ? (remoteUser.videoTrack ?? null) : u.videoTrack,
                      audioTrack: mediaType === "audio" ? (remoteUser.audioTrack ?? null) : u.audioTrack,
                    }
                  : u
              );
            }
            return [
              ...prev,
              {
                uid: remoteUser.uid,
                videoTrack: mediaType === "video" ? (remoteUser.videoTrack ?? null) : null,
                audioTrack: mediaType === "audio" ? (remoteUser.audioTrack ?? null) : null,
              },
            ];
          });
        });

        client.on("user-unpublished", (remoteUser: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
          console.log("[Agora] Remote user unpublished:", remoteUser.uid, mediaType);
          setRemoteUsers((prev) =>
            prev.map((u) =>
              u.uid === remoteUser.uid
                ? {
                    ...u,
                    videoTrack: mediaType === "video" ? null : u.videoTrack,
                    audioTrack: mediaType === "audio" ? null : u.audioTrack,
                  }
                : u
            )
          );
        });

        client.on("user-left", (remoteUser: IAgoraRTCRemoteUser) => {
          console.log("[Agora] Remote user left:", remoteUser.uid);
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== remoteUser.uid));
        });

        // Join with EXACT validated appId and EXACT uid used to generate the token
        console.log("APP_ID:", APP_ID);
        console.log("[Agora] Joining —", {
          joinAppId,
          joinAppId_length: joinAppId.length,
          channel: channelName,
          uid: sessionUid,
          token_uid_match: tokenResp.uid === sessionUid,
          channel_match: tokenResp.channel === channelName,
        });
        await client.join(joinAppId, channelName, tokenResp.token, sessionUid);
        console.log("[Agora] Joined successfully, uid:", sessionUid);

        if (cancelled) {
          await client.leave();
          return;
        }

        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        console.log("[Agora] Local tracks created");
        localAudioTrackRef.current = audioTrack;
        localVideoTrackRef.current = videoTrack;

        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }

        await client.publish([audioTrack, videoTrack]);
        console.log("[Agora] Local tracks published");

        if (!cancelled) setJoined(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Agora] Error:", err);
        if (!cancelled) setError(msg || "Failed to join classroom.");
      }
    }

    join();

    return () => {
      cancelled = true;
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current?.close();
      clientRef.current?.leave().catch(() => {});
    };
    // channelName is derived from classId (stable); sessionUid is a ref value (never changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);

  async function toggleMic() {
    if (!localAudioTrackRef.current) return;
    const newMuted = !micMuted;
    await localAudioTrackRef.current.setEnabled(!newMuted);
    setMicMuted(newMuted);
  }

  async function toggleCam() {
    if (!localVideoTrackRef.current) return;
    const newOff = !camOff;
    await localVideoTrackRef.current.setEnabled(!newOff);
    setCamOff(newOff);
  }

  async function handleLeave() {
    localVideoTrackRef.current?.close();
    localAudioTrackRef.current?.close();
    await clientRef.current?.leave().catch(() => {});
    onLeave?.();
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950 text-white p-8">
        <div className="text-center space-y-4">
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={onLeave}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            Leave
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      {/* Video grid */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="grid gap-4 h-full"
          style={{
            gridTemplateColumns:
              remoteUsers.length === 0
                ? "1fr"
                : remoteUsers.length === 1
                ? "repeat(2, 1fr)"
                : "repeat(3, 1fr)",
          }}
        >
          {/* Local video */}
          <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
            <div ref={localVideoRef} className="w-full h-full" />
            {!joined && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-gray-400 text-sm">Connecting...</div>
              </div>
            )}
            {camOff && joined && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
                  👤
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 rounded px-2 py-0.5 text-xs">
              You {micMuted ? "🔇" : ""}
            </div>
          </div>

          {/* Remote users */}
          {remoteUsers.map((user) => (
            <RemoteUserTile key={String(user.uid)} user={user} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-800 bg-gray-900">
        <button
          onClick={toggleMic}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            micMuted
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {micMuted ? "🔇 Unmute" : "🎙 Mute"}
        </button>
        <button
          onClick={toggleCam}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            camOff
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {camOff ? "📷 Show Camera" : "📷 Hide Camera"}
        </button>
        <button
          onClick={handleLeave}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-700 hover:bg-red-800 transition-colors"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
