"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectionState, Participant, RemoteTrack, Room, RoomEvent, Track } from "livekit-client";

import { useAuth } from "@/components/auth-provider";
import { LoadingPanel, Spinner } from "@/components/ui-state";
import { VideoTile } from "@/components/video-tile";
import { usePageTitle } from "@/hooks/use-page-title";
import { type SessionUser, type UserRole } from "@/lib/demo-auth";
import {
  endLiveClass,
  fetchClassSession,
  getResolvedLiveKitUrl,
  joinClassPresence,
  leaveClassPresence,
  requestLiveKitToken,
  startRecordingSession,
  stopRecordingSession,
  uploadRecording,
  type LiveClassSession,
} from "@/lib/api";

type ClassroomRole = Extract<UserRole, "teacher" | "student">;

type LiveClassroomRoomProps = {
  classId: string;
  role: ClassroomRole;
};

type ParticipantCard = {
  identity: string;
  name: string;
  stream: MediaStream | null;
  isLocal: boolean;
  isTeacher: boolean;
};

function createStreamFromParticipant(participant: Participant): MediaStream | null {
  const stream = new MediaStream();

  for (const publication of participant.trackPublications.values()) {
    const track = publication.track;

    if (track?.mediaStreamTrack) {
      stream.addTrack(track.mediaStreamTrack);
    }
  }

  return stream.getTracks().length ? stream : null;
}

function hasPublishedTrack(participant: Participant, kind: Track.Kind): boolean {
  for (const publication of participant.trackPublications.values()) {
    if (publication.track?.kind === kind) {
      return !publication.track.isMuted;
    }
  }

  return false;
}

export function LiveClassroomRoom({
  classId,
  role,
}: LiveClassroomRoomProps) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [classroom, setClassroom] = useState<LiveClassSession | null>(null);
  const [participants, setParticipants] = useState<ParticipantCard[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState("connecting");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [deviceMessage, setDeviceMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [recordingSuccess, setRecordingSuccess] = useState("");
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const classroomRef = useRef<LiveClassSession | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const hasRegisteredPresenceRef = useRef(false);
  const isMountedRef = useRef(true);
  const manualDisconnectRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const pendingStopResolveRef = useRef<(() => void) | null>(null);
  const recordingSessionIdRef = useRef<string | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const dashboardPath =
    role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
  const titlePrefix = role === "teacher" ? "Teacher Classroom" : "Student Classroom";

  usePageTitle(
    classroom ? `${titlePrefix} - ${classroom.title}` : `${titlePrefix} Loading`,
  );

  const localParticipantCard = useMemo<ParticipantCard | null>(() => {
    if (!session) {
      return null;
    }

    return {
      identity: session.email,
      name: session.name,
      stream: localStream,
      isLocal: true,
      isTeacher: role === "teacher",
    };
  }, [localStream, role, session]);

  const remoteParticipants = useMemo(() => {
    return participants.filter((participant) => !participant.isLocal);
  }, [participants]);

  const participantCount = useMemo(() => {
    const localCount = localParticipantCard ? 1 : 0;
    return Math.max(classroom?.participants_count ?? 0, localCount + remoteParticipants.length);
  }, [classroom?.participants_count, localParticipantCard, remoteParticipants.length]);

  const teacherStreamCard = useMemo(() => {
    return remoteParticipants.find(
      (participant) => participant.identity === classroom?.teacher_email,
    );
  }, [classroom?.teacher_email, remoteParticipants]);

  const studentTiles = useMemo(() => {
    return remoteParticipants.filter(
      (participant) => participant.identity !== classroom?.teacher_email,
    );
  }, [classroom?.teacher_email, remoteParticipants]);

  function syncRoomState(room: Room, currentClassroom: LiveClassSession | null) {
    const nextLocalStream = createStreamFromParticipant(room.localParticipant);
    localStreamRef.current = nextLocalStream;
    setLocalStream(nextLocalStream);
    setMicEnabled(hasPublishedTrack(room.localParticipant, Track.Kind.Audio));
    setCameraEnabled(hasPublishedTrack(room.localParticipant, Track.Kind.Video));

    const nextParticipants = Array.from(room.remoteParticipants.values()).map(
      (participant: Participant) => ({
        identity: participant.identity,
        name: participant.name || participant.identity,
        stream: createStreamFromParticipant(participant),
        isLocal: false,
        isTeacher: participant.identity === currentClassroom?.teacher_email,
      }),
    );

    setParticipants(nextParticipants);
  }

  async function refreshClassroomSession() {
    try {
      const nextClassroom = await fetchClassSession(classId);

      if (!isMountedRef.current) {
        return nextClassroom;
      }

      setClassroom(nextClassroom);
      classroomRef.current = nextClassroom;
      return nextClassroom;
    } catch {
      return null;
    }
  }

  function getRecordingMimeType(): string {
    const supportedTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    for (const mimeType of supportedTypes) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return "";
  }

  async function uploadRecordedBlob(blob: Blob) {
    if (!session || !classroom) {
      return;
    }

    setIsUploadingRecording(true);
    setRecordingError("");
    setRecordingSuccess("");

    const sessionId = recordingSessionIdRef.current;

    try {
      // If we pre-created a DB entry via /recordings/start, mark it available immediately.
      // This guarantees the recording appears in the panel even if file upload fails.
      if (sessionId) {
        try {
          await stopRecordingSession({ recordingId: sessionId });
        } catch {
          // stopRecordingSession failing is non-fatal — the entry already exists in DB.
        }
      }

      // Best-effort: try to upload the actual video blob so it can be played back.
      if (blob.size > 0) {
        const fileExtension = blob.type.includes("webm") ? "webm" : "bin";
        const recordingFile = new File(
          [blob],
          `${classId}-${Date.now()}.${fileExtension}`,
          { type: blob.type || "video/webm" },
        );

        try {
          await uploadRecording({
            classId,
            teacherName: session.name,
            title: classroom.title,
            file: recordingFile,
            recordingId: sessionId ?? undefined,
          });
        } catch {
          // File upload failed (e.g. ephemeral storage) but the metadata entry
          // was already saved by stopRecordingSession above.
        }
      }

      recordingSessionIdRef.current = null;
      setRecordingSuccess("Recording saved. It is now visible in the Recordings panel.");
    } catch (requestError) {
      setRecordingError(
        requestError instanceof Error
          ? requestError.message
          : "Recording save failed.",
      );
    } finally {
      setIsUploadingRecording(false);
    }
  }

  async function startRecording() {
    if (role !== "teacher") {
      return;
    }

    if (!localStreamRef.current) {
      setRecordingError("Camera and microphone must be ready before recording.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setRecordingError("Recording is not supported in this browser.");
      return;
    }

    try {
      const mimeType = getRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(localStreamRef.current, { mimeType })
        : new MediaRecorder(localStreamRef.current);

      recordingChunksRef.current = [];
      setRecordingError("");
      setRecordingSuccess("");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingError("Recording failed while capturing the class.");
      };

      recorder.onstop = async () => {
        const recordedBlob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });

        mediaRecorderRef.current = null;
        setIsRecording(false);

        if (recordedBlob.size > 0) {
          await uploadRecordedBlob(recordedBlob);
        } else {
          // Even with no blob data, try to mark the session as available if it was pre-created.
          if (recordingSessionIdRef.current) {
            try {
              await stopRecordingSession({ recordingId: recordingSessionIdRef.current });
              recordingSessionIdRef.current = null;
              setRecordingSuccess("Recording saved to the Recordings panel.");
            } catch {
              // ignore
            }
          }
          setRecordingError("No recording data was captured.");
        }

        pendingStopResolveRef.current?.();
        pendingStopResolveRef.current = null;
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Pre-create a DB entry immediately so it appears in the Recordings panel
      // even if the final file upload fails or is slow.
      if (classroom) {
        try {
          const sessionResponse = await startRecordingSession({
            classId,
            title: classroom.title,
          });
          recordingSessionIdRef.current = sessionResponse.recording_id;
        } catch {
          // Non-fatal: we'll fall back to creating the entry via uploadRecording on stop.
          recordingSessionIdRef.current = null;
        }
      }
    } catch {
      setRecordingError("Unable to start recording in this browser.");
    }
  }

  function stopRecording(): Promise<void> {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;

      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        resolve();
        return;
      }

      pendingStopResolveRef.current = resolve;
      recorder.stop();
    });
  }

  async function publishRoomEndedNotice() {
    if (!roomRef.current) {
      return;
    }

    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: "room-ended",
          message: "The teacher ended this class session.",
        }),
      );
      await roomRef.current.localParticipant.publishData(payload, { reliable: true });
    } catch {
      return;
    }
  }

  function scheduleRedirectBack() {
    window.setTimeout(() => {
      router.replace(dashboardPath);
    }, 1600);
  }

  function handleRemoteRoomEnded(message: string) {
    if (manualDisconnectRef.current) {
      return;
    }

    manualDisconnectRef.current = true;
    setStatusMessage(message);

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    scheduleRedirectBack();
  }

  async function registerPresence() {
    if (!session || hasRegisteredPresenceRef.current) {
      return;
    }

    try {
      const updatedClassroom = await joinClassPresence({
        classId,
        role,
        participantEmail: session.email,
        participantName: session.name,
      });
      hasRegisteredPresenceRef.current = true;
      setClassroom(updatedClassroom);
      classroomRef.current = updatedClassroom;
    } catch {
      return;
    }
  }

  async function unregisterPresence() {
    if (!session || !hasRegisteredPresenceRef.current) {
      return;
    }

    try {
      await leaveClassPresence({
        classId,
        role,
        participantEmail: session.email,
        participantName: session.name,
      });
    } catch {
      return;
    } finally {
      hasRegisteredPresenceRef.current = false;
    }
  }

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function initializeRoom() {
      if (isAuthLoading) {
        return;
      }

      if (!user || user.role !== role) {
        router.replace("/login");
        return;
      }

      setSession(user);

      try {
        const classroomSession = await fetchClassSession(classId);

        if (role === "student" && classroomSession.status !== "live") {
          setError("No live session found right now.");
          setIsLoading(false);
          return;
        }

        setClassroom(classroomSession);
        classroomRef.current = classroomSession;

        const tokenResponse = await requestLiveKitToken({
          roomName: classId,
          participantName: user.name,
          participantEmail: user.email,
          role,
        });

        const liveKitUrl = getResolvedLiveKitUrl(tokenResponse.url);

        if (!liveKitUrl) {
          throw new Error(
            "The live classroom server URL is missing. Please set LiveKit environment variables.",
          );
        }

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        roomRef.current = room;

        room
          .on(RoomEvent.ConnectionStateChanged, (nextState: ConnectionState) => {
            setConnectionState(nextState);
          })
          .on(RoomEvent.Connected, async () => {
            setConnectionState("connected");
            await registerPresence();
            syncRoomState(room, classroomSession);
            setIsLoading(false);
          })
          .on(RoomEvent.Reconnecting, () => {
            setConnectionState("reconnecting");
            setStatusMessage("Connection is unstable. Trying to reconnect to the classroom.");
          })
          .on(RoomEvent.Reconnected, () => {
            setConnectionState("connected");
            setStatusMessage("Classroom connection restored.");
            void registerPresence();
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.ParticipantConnected, () => {
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.ParticipantDisconnected, () => {
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            if (track.kind === Track.Kind.Audio && track.mediaStreamTrack && track.sid) {
              const audioEl = document.createElement("audio");
              audioEl.srcObject = new MediaStream([track.mediaStreamTrack]);
              audioEl.autoplay = true;
              void audioEl.play().catch(() => {
                // Autoplay blocked — user must tap "Enable Audio"
              });
              document.body.appendChild(audioEl);
              audioElementsRef.current.set(track.sid, audioEl);
            }
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
            if (track.kind === Track.Kind.Audio && track.sid) {
              const audioEl = audioElementsRef.current.get(track.sid);
              if (audioEl) {
                audioEl.srcObject = null;
                audioEl.remove();
                audioElementsRef.current.delete(track.sid);
              }
            }
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.LocalTrackPublished, () => {
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.LocalTrackUnpublished, () => {
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.TrackMuted, () => {
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.TrackUnmuted, () => {
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.DataReceived, (payload: Uint8Array) => {
            try {
              const parsed = JSON.parse(new TextDecoder().decode(payload)) as {
                type?: string;
                message?: string;
              };

              if (parsed.type === "room-ended") {
                handleRemoteRoomEnded(
                  parsed.message ?? "The teacher ended this class session.",
                );
              }
            } catch {
              return;
            }
          })
          .on(RoomEvent.Disconnected, () => {
            if (!manualDisconnectRef.current) {
              setStatusMessage("Connection lost. Please return to the dashboard.");
            }
          });

        await room.connect(liveKitUrl, tokenResponse.token);

        try {
          await room.localParticipant.setCameraEnabled(true);
          await room.localParticipant.setMicrophoneEnabled(true, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
          // Ensure all local audio tracks are active (not silenced)
          room.localParticipant.audioTrackPublications.forEach((pub) => {
            if (pub.track?.isMuted) {
              void pub.track.unmute();
            }
          });
        } catch (deviceError) {
          if (
            deviceError instanceof DOMException &&
            deviceError.name === "NotAllowedError"
          ) {
            setDeviceMessage("Camera or microphone permission was denied.");
          } else {
            setDeviceMessage("Unable to start your camera or microphone.");
          }
        }

        syncRoomState(room, classroomSession);

        intervalRef.current = window.setInterval(() => {
          void (async () => {
            const latestClassroom = await refreshClassroomSession();

            if (latestClassroom?.status === "ended") {
              handleRemoteRoomEnded("This class session has ended.");
            }
          })();
        }, 12000);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "NotAllowedError"
        ) {
          setError("Camera or microphone permission was denied.");
        } else if (requestError instanceof Error) {
          setError(requestError.message);
        } else {
          setError("Unable to connect to the classroom.");
        }
        setIsLoading(false);
      }
    }

    void initializeRoom();

    return () => {
      const shouldAutoCleanup = !manualDisconnectRef.current;
      manualDisconnectRef.current = true;

      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      void (async () => {
        if (!shouldAutoCleanup) {
          return;
        }

        await unregisterPresence();
      })();

      audioElementsRef.current.forEach((audioEl) => {
        audioEl.srcObject = null;
        audioEl.remove();
      });
      audioElementsRef.current.clear();

      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [classId, role, router, user, isAuthLoading]);

  async function handleLeaveOrEndClass() {
    if (!session) {
      return;
    }

    manualDisconnectRef.current = true;

    if (role === "teacher" && isRecording) {
      await stopRecording();
    }

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    try {
      if (role === "teacher") {
        await publishRoomEndedNotice();
        await endLiveClass(classId, session.email);
      } else {
        await unregisterPresence();
      }
    } catch (requestError) {
      setStatusMessage(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update classroom status.",
      );
    }

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    router.push(dashboardPath);
  }

  async function toggleMic() {
    if (!roomRef.current) {
      return;
    }

    const nextEnabled = !micEnabled;

    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(nextEnabled);
      setMicEnabled(nextEnabled);
      syncRoomState(roomRef.current, classroomRef.current);
    } catch {
      setDeviceMessage("Unable to update microphone access.");
    }
  }

  async function toggleCamera() {
    if (!roomRef.current) {
      return;
    }

    const nextEnabled = !cameraEnabled;

    try {
      await roomRef.current.localParticipant.setCameraEnabled(nextEnabled);
      setCameraEnabled(nextEnabled);
      syncRoomState(roomRef.current, classroomRef.current);
    } catch {
      setDeviceMessage("Unable to update camera access.");
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
          <LoadingPanel
            title="Joining classroom"
            message="We are preparing your LiveKit room, camera, microphone, and class session."
          />
        </div>
      </main>
    );
  }

  if (!session || !classroom || error) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
          <div className="rounded-[2rem] border border-red-100 bg-white p-8 shadow-soft">
            <p className="text-base text-red-600">
              {error || "Classroom session not available."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10">
        <header className="rounded-[2rem] border border-slate-100 bg-white px-5 py-5 shadow-soft sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
                {titlePrefix}
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-800 sm:text-3xl">
                {classroom.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
                {classroom.status === "live" ? "Live" : classroom.status}
              </div>
              <div className="inline-flex rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
                {connectionState}
              </div>
              {role === "teacher" && isRecording ? (
                <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
                  Recording Active
                </div>
              ) : null}
              {role === "teacher" && isUploadingRecording ? (
                <div className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                  Uploading Recording
                </div>
              ) : null}
              <div className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                {participantCount} participants
              </div>
            </div>
          </div>
        </header>

        {statusMessage ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-700">
            {statusMessage}
          </div>
        ) : null}

        {deviceMessage ? (
          <div className="mt-6 rounded-[1.5rem] border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
            {deviceMessage}
          </div>
        ) : null}

        {!audioUnlocked && connectionState === "connected" ? (
          <div className="mt-6 rounded-[1.5rem] border border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-blue-700">
                Tap "Enable Audio" to hear participants (required on mobile).
              </p>
              <button
                type="button"
                onClick={() => {
                  audioElementsRef.current.forEach((audioEl) => {
                    void audioEl.play().catch(() => {});
                  });
                  setAudioUnlocked(true);
                }}
                className="shrink-0 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white"
              >
                Enable Audio
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  {role === "teacher"
                    ? classroom.teacher_name
                    : `Live session with ${classroom.teacher_name}`}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-800">
                  {role === "teacher" ? "LiveKit classroom active" : "Connected classroom"}
                </p>
              </div>
              <div className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
                Session {classroom.status}
              </div>
            </div>

            <div className="mt-6">
              <VideoTile
                stream={
                  role === "teacher"
                    ? studentTiles[0]?.stream ?? null
                    : teacherStreamCard?.stream ?? null
                }
                title={
                  role === "teacher"
                    ? studentTiles[0]?.name ?? "Waiting for students"
                    : teacherStreamCard?.name ?? classroom.teacher_name
                }
                subtitle={
                  role === "teacher" ? "Student video" : "Teacher live stream"
                }
                priority
                className="min-h-[280px] sm:min-h-[360px] lg:min-h-[420px]"
              />
            </div>

            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={() => void toggleMic()}
                className={`inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold sm:w-auto ${
                  micEnabled
                    ? "border border-slate-200 bg-white text-slate-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {micEnabled ? "Mic On" : "Mic Off"}
              </button>
              <button
                type="button"
                onClick={() => void toggleCamera()}
                className={`inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold sm:w-auto ${
                  cameraEnabled
                    ? "border border-slate-200 bg-white text-slate-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {cameraEnabled ? "Camera On" : "Camera Off"}
              </button>
              {role === "teacher" ? (
                <button
                  type="button"
                  onClick={isRecording ? () => void stopRecording() : () => void startRecording()}
                  disabled={isUploadingRecording}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto ${
                    isRecording
                      ? "bg-amber-100 text-amber-800"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {isUploadingRecording ? <Spinner className="h-4 w-4" /> : null}
                  {isRecording ? "Stop Recording" : "Record"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleLeaveOrEndClass}
                className="inline-flex w-full items-center justify-center rounded-full bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-100 sm:w-auto"
              >
                {role === "teacher" ? "End Class" : "Leave Class"}
              </button>
            </div>

            {role === "teacher" && recordingError ? (
              <div className="mt-4 rounded-[1.25rem] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {recordingError}
              </div>
            ) : null}

            {role === "teacher" && recordingSuccess ? (
              <div className="mt-4 rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {recordingSuccess}
              </div>
            ) : null}

            {remoteParticipants.length === 0 ? (
              <div className="mt-4 rounded-[1.25rem] border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                {role === "teacher"
                  ? "No students are visible yet. Keep the room open and they will appear automatically."
                  : "Waiting for the teacher or classmates to appear in the room."}
              </div>
            ) : null}
          </section>

          <div className="grid gap-6">
            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                {role === "teacher" ? "Participants" : "Self View"}
              </p>

              {role === "teacher" ? (
                <div className="mt-5 space-y-3">
                  {localParticipantCard ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
                      {localParticipantCard.name} (You)
                    </div>
                  ) : null}
                  {studentTiles.length ? (
                    studentTiles.map((participant) => (
                      <div
                        key={participant.identity}
                        className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700"
                      >
                        {participant.name}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
                      Students will appear here after they join the room.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5">
                  <VideoTile
                    stream={localStream}
                    title={session.name}
                    subtitle="Your camera"
                    muted
                    className="min-h-[180px] sm:min-h-[220px]"
                  />
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
                {role === "teacher" ? "Student Tiles" : "Classroom Tiles"}
              </p>
              <div className="mt-5 grid gap-4">
                {localParticipantCard ? (
                  <VideoTile
                    stream={localParticipantCard.stream}
                    title={localParticipantCard.name}
                    subtitle="Your camera"
                    muted
                    className="min-h-[160px] sm:min-h-[180px]"
                  />
                ) : null}
                {(role === "teacher" ? studentTiles : remoteParticipants).map((participant) => (
                  <VideoTile
                    key={participant.identity}
                    stream={participant.stream}
                    title={participant.name}
                    subtitle={participant.isTeacher ? "Teacher" : "Student"}
                    className="min-h-[160px] sm:min-h-[180px]"
                  />
                ))}
                {!remoteParticipants.length ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                    Participant video tiles will appear here when others join the room.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">
                Classroom Notes
              </p>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  LiveKit is handling the room connection for a more stable classroom session.
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  Recordings still save through the existing LMS upload workflow.
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  Room name: {classId}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
