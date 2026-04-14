"use client";

import { useEffect, useRef, useState } from "react";
import { fetchAgoraToken } from "@/lib/api";

interface AgoraClassroomProps {
  classId: string;
  uid?: number;
  onLeave?: () => void;
}

interface RemoteUser {
  uid: string | number;
  videoTrack: { play: (el: HTMLElement) => void; stop: () => void } | null;
  audioTrack: { play: () => void; stop: () => void } | null;
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
  }, [user.videoTrack]);

  useEffect(() => {
    if (user.audioTrack) {
      user.audioTrack.play();
    }
    return () => {
      user.audioTrack?.stop();
    };
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

export default function AgoraClassroom({ classId, uid = 0, onLeave }: AgoraClassroomProps) {
  const localVideoRef = useRef<HTMLDivElement>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  // Refs to hold Agora objects for cleanup
  const clientRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);

  const channelName = `wearekids${classId.replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    let cancelled = false;

    async function join() {
      try {
        console.log("[Agora] Loading SDK...");
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;

        console.log("[Agora] Fetching token for channel:", channelName);
        const { token, app_id } = await fetchAgoraToken(channelName, uid);
        console.log("[Agora] Token received, app_id:", app_id);

        if (cancelled) return;

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        clientRef.current = client;

        client.on("user-published", async (remoteUser: any, mediaType: string) => {
          console.log("[Agora] Remote user published:", remoteUser.uid, mediaType);
          await client.subscribe(remoteUser, mediaType);

          setRemoteUsers((prev) => {
            const existing = prev.find((u) => u.uid === remoteUser.uid);
            if (existing) {
              return prev.map((u) =>
                u.uid === remoteUser.uid
                  ? {
                      ...u,
                      videoTrack: mediaType === "video" ? remoteUser.videoTrack : u.videoTrack,
                      audioTrack: mediaType === "audio" ? remoteUser.audioTrack : u.audioTrack,
                    }
                  : u
              );
            }
            return [
              ...prev,
              {
                uid: remoteUser.uid,
                videoTrack: mediaType === "video" ? remoteUser.videoTrack ?? null : null,
                audioTrack: mediaType === "audio" ? remoteUser.audioTrack ?? null : null,
              },
            ];
          });
        });

        client.on("user-unpublished", (remoteUser: any, mediaType: string) => {
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

        client.on("user-left", (remoteUser: any) => {
          console.log("[Agora] Remote user left:", remoteUser.uid);
          setRemoteUsers((prev) => prev.filter((u) => u.uid !== remoteUser.uid));
        });

        console.log("[Agora] Joining channel:", channelName, "uid:", uid);
        await client.join(app_id, channelName, token, uid || null);
        console.log("[Agora] Joined successfully");

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
      } catch (err: any) {
        console.error("[Agora] Error:", err);
        if (!cancelled) setError(err?.message ?? "Failed to join classroom.");
      }
    }

    join();

    return () => {
      cancelled = true;
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current?.close();
      clientRef.current?.leave().catch(() => {});
    };
  }, [channelName, uid]);

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
