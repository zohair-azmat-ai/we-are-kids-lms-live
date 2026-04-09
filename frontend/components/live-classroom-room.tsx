"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectionState, Participant, RemoteTrack, Room, RoomEvent, Track } from "livekit-client";
import { AnimatePresence, motion } from "framer-motion";

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

// ─── Inline SVG icons ───────────────────────────────────────────────────────

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function VideoOnIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function VideoOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PhoneOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 17.29 7.76 15.6 6.07 13" />
      <path d="M6.09 3.91A19.79 19.79 0 0 1 14.72 7" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

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
  micEnabled: boolean;
  cameraEnabled: boolean;
};

// ─── Animation variants ─────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const panelVariants = {
  hidden: { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 320, damping: 28 } },
  exit: { opacity: 0, x: 32 },
};

const notesVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

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
  const [activeSpeakerIdentities, setActiveSpeakerIdentities] = useState<Set<string>>(new Set());
  const [showParticipants, setShowParticipants] = useState(false);

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
      micEnabled,
      cameraEnabled,
    };
  }, [localStream, role, session, micEnabled, cameraEnabled]);

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

  const allParticipantsForPanel = useMemo(() => {
    return localParticipantCard
      ? [localParticipantCard, ...remoteParticipants]
      : remoteParticipants;
  }, [localParticipantCard, remoteParticipants]);

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
        micEnabled: hasPublishedTrack(participant, Track.Kind.Audio),
        cameraEnabled: hasPublishedTrack(participant, Track.Kind.Video),
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
      if (sessionId) {
        try {
          await stopRecordingSession({ recordingId: sessionId });
        } catch {
          // stopRecordingSession failing is non-fatal.
        }
      }

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
          // File upload failed but metadata entry already saved.
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

      if (classroom) {
        try {
          const sessionResponse = await startRecordingSession({
            classId,
            title: classroom.title,
          });
          recordingSessionIdRef.current = sessionResponse.recording_id;
        } catch {
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
          .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
            setActiveSpeakerIdentities(new Set(speakers.map((s) => s.identity)));
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

  const mainTileIdentity =
    role === "teacher"
      ? studentTiles[0]?.identity
      : teacherStreamCard?.identity;

  return (
    <motion.main
      className="min-h-screen"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* ── Participants overlay — fixed above all content ──────────────── */}
      <AnimatePresence>
        {showParticipants ? (
          <>
            {/* Backdrop */}
            <motion.div
              key="participants-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowParticipants(false)}
            />

            {/* Panel — bottom sheet on mobile, right side panel on sm+ */}
            <motion.div
              key="participants-overlay"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-0 sm:h-full sm:max-h-full sm:w-[340px] sm:rounded-l-[2rem] sm:rounded-tr-none"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[2rem] border-b border-slate-100 bg-white px-6 py-5 sm:rounded-tl-[2rem] sm:rounded-tr-none">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                    Participants
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {allParticipantsForPanel.length} in this session
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setShowParticipants(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                  aria-label="Close participants panel"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </motion.button>
              </div>

              {/* Participant rows */}
              <div className="px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {allParticipantsForPanel.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <svg className="h-10 w-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <p className="text-sm text-slate-500">No other participants yet.</p>
                    <p className="text-xs text-slate-400">Share the class link to invite others.</p>
                  </div>
                ) : (
                  <motion.ul
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="space-y-2"
                  >
                    {allParticipantsForPanel.map((participant) => {
                      const isSpeaking = activeSpeakerIdentities.has(participant.identity);
                      const showMic = participant.isLocal ? micEnabled : participant.micEnabled;
                      const showCam = participant.isLocal ? cameraEnabled : participant.cameraEnabled;

                      return (
                        <motion.li
                          key={participant.identity}
                          variants={fadeUp}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
                            isSpeaking
                              ? "border-green-200 bg-green-50"
                              : "border-slate-100 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                                isSpeaking ? "animate-pulse bg-green-500" : "bg-slate-300"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {participant.name}
                                {participant.isLocal ? (
                                  <span className="ml-1.5 text-xs font-normal text-slate-400">(You)</span>
                                ) : null}
                              </p>
                              <p className={`text-xs ${isSpeaking ? "text-green-600" : "text-slate-400"}`}>
                                {isSpeaking
                                  ? "Speaking..."
                                  : participant.isTeacher
                                    ? "Teacher"
                                    : "Student"}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 pl-3">
                            {showMic
                              ? <MicIcon className="h-4 w-4 text-emerald-500" />
                              : <MicOffIcon className="h-4 w-4 text-red-400" />}
                            {showCam
                              ? <VideoOnIcon className="h-4 w-4 text-emerald-500" />
                              : <VideoOffIcon className="h-4 w-4 text-slate-400" />}
                          </div>
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.header
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-[2rem] border border-slate-100 bg-white px-5 py-5 shadow-soft sm:px-6"
        >
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
              <AnimatePresence>
                {role === "teacher" && isRecording ? (
                  <motion.div
                    key="rec-badge"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800"
                  >
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    Recording
                  </motion.div>
                ) : null}
              </AnimatePresence>
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
        </motion.header>

        {/* ── Banners ─────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {statusMessage ? (
            <motion.div
              key="status-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 rounded-[1.5rem] border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-700"
            >
              {statusMessage}
            </motion.div>
          ) : null}

          {deviceMessage ? (
            <motion.div
              key="device-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 rounded-[1.5rem] border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600"
            >
              {deviceMessage}
            </motion.div>
          ) : null}

          {!audioUnlocked && connectionState === "connected" ? (
            <motion.div
              key="audio-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 rounded-[1.5rem] border border-blue-100 bg-blue-50 px-5 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-blue-700">
                  Tap "Enable Audio" to hear participants (required on mobile).
                </p>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    audioElementsRef.current.forEach((audioEl) => {
                      void audioEl.play().catch(() => {});
                    });
                    setAudioUnlocked(true);
                  }}
                  className="shrink-0 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white"
                >
                  Enable Audio
                </motion.button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Main grid ───────────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">

          {/* ── Left: main video + control bar ─────────────────────────── */}
          <motion.section
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.05 } as never}
            className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft"
          >
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

            {/* Main video tile */}
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
                isSpeaking={
                  mainTileIdentity
                    ? activeSpeakerIdentities.has(mainTileIdentity)
                    : false
                }
                className="min-h-[280px] sm:min-h-[360px] lg:min-h-[420px]"
              />
            </div>

            {/* ── Zoom-style control bar ────────────────────────────────── */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-slate-100 bg-white/80 px-3 py-3 shadow-soft backdrop-blur-sm sm:gap-2">

              {/* Mic */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={() => void toggleMic()}
                title={micEnabled ? "Mute microphone" : "Unmute microphone"}
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                  micEnabled
                    ? "text-slate-700 hover:bg-slate-50"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {micEnabled
                  ? <MicIcon className="h-5 w-5" />
                  : <MicOffIcon className="h-5 w-5" />}
                <span className="text-[10px] font-medium leading-none">
                  {micEnabled ? "Mute" : "Unmute"}
                </span>
              </motion.button>

              {/* Camera */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={() => void toggleCamera()}
                title={cameraEnabled ? "Stop video" : "Start video"}
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                  cameraEnabled
                    ? "text-slate-700 hover:bg-slate-50"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {cameraEnabled
                  ? <VideoOnIcon className="h-5 w-5" />
                  : <VideoOffIcon className="h-5 w-5" />}
                <span className="text-[10px] font-medium leading-none">
                  {cameraEnabled ? "Stop Video" : "Start Video"}
                </span>
              </motion.button>

              {/* Participants toggle */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={() => setShowParticipants((prev) => !prev)}
                title="Show participants"
                className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                  showParticipants
                    ? "bg-blue-100 text-blue-600"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <UsersIcon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">Participants</span>
              </motion.button>

              {/* Record (teacher only) */}
              {role === "teacher" ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  onClick={isRecording ? () => void stopRecording() : () => void startRecording()}
                  disabled={isUploadingRecording}
                  title={isRecording ? "Stop recording" : "Start recording"}
                  className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isRecording
                      ? "bg-amber-100 text-amber-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center">
                    {isUploadingRecording ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <span
                        className={`h-3.5 w-3.5 rounded-full ${
                          isRecording ? "bg-amber-600" : "bg-red-500"
                        }`}
                      />
                    )}
                  </span>
                  <span className="text-[10px] font-medium leading-none">
                    {isRecording ? "Stop Rec" : "Record"}
                  </span>
                </motion.button>
              ) : null}

              <div className="mx-1 h-8 w-px bg-slate-200" />

              {/* End / Leave */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.05, boxShadow: "0 4px 16px rgba(239,68,68,0.35)" }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={handleLeaveOrEndClass}
                title={role === "teacher" ? "End class for everyone" : "Leave class"}
                className="flex flex-col items-center gap-1 rounded-xl bg-red-500 px-3 py-2 text-white shadow-sm transition-colors"
              >
                <PhoneOffIcon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">
                  {role === "teacher" ? "End Class" : "Leave"}
                </span>
              </motion.button>
            </div>

            {/* Recording status */}
            <AnimatePresence>
              {role === "teacher" && recordingError ? (
                <motion.div
                  key="rec-error"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="mt-4 rounded-[1.25rem] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  {recordingError}
                </motion.div>
              ) : null}
              {role === "teacher" && recordingSuccess ? (
                <motion.div
                  key="rec-success"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="mt-4 rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  {recordingSuccess}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {remoteParticipants.length === 0 ? (
              <div className="mt-4 rounded-[1.25rem] border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                {role === "teacher"
                  ? "No students are visible yet. Keep the room open and they will appear automatically."
                  : "Waiting for the teacher or classmates to appear in the room."}
              </div>
            ) : null}
          </motion.section>

          {/* ── Right sidebar ───────────────────────────────────────────── */}
          <div className="grid gap-6">

            {/* Self view / teacher participant list */}
            <motion.section
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 } as never}
              className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
                {role === "teacher" ? "Participants" : "Self View"}
              </p>

              {role === "teacher" ? (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="mt-5 space-y-3"
                >
                  {localParticipantCard ? (
                    <motion.div
                      variants={fadeUp}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        {activeSpeakerIdentities.has(localParticipantCard.identity) ? (
                          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-slate-300" />
                        )}
                        <span className="text-sm text-slate-700">{localParticipantCard.name} (You)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {micEnabled
                          ? <MicIcon className="h-4 w-4 text-emerald-500" />
                          : <MicOffIcon className="h-4 w-4 text-red-400" />}
                        {cameraEnabled
                          ? <VideoOnIcon className="h-4 w-4 text-emerald-500" />
                          : <VideoOffIcon className="h-4 w-4 text-slate-400" />}
                      </div>
                    </motion.div>
                  ) : null}
                  {studentTiles.length ? (
                    studentTiles.map((participant) => (
                      <motion.div
                        key={participant.identity}
                        variants={fadeUp}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex items-center gap-2">
                          {activeSpeakerIdentities.has(participant.identity) ? (
                            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-slate-300" />
                          )}
                          <span className="text-sm text-slate-700">{participant.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {participant.micEnabled
                            ? <MicIcon className="h-4 w-4 text-emerald-500" />
                            : <MicOffIcon className="h-4 w-4 text-red-400" />}
                          {participant.cameraEnabled
                            ? <VideoOnIcon className="h-4 w-4 text-emerald-500" />
                            : <VideoOffIcon className="h-4 w-4 text-slate-400" />}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      Students will appear here after they join the room.
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="mt-5">
                  <VideoTile
                    stream={localStream}
                    title={session.name}
                    subtitle="Your camera"
                    muted
                    isSpeaking={activeSpeakerIdentities.has(session.email)}
                    className="min-h-[180px] sm:min-h-[220px]"
                  />
                </div>
              )}
            </motion.section>

            {/* Video tiles */}
            <motion.section
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.15 } as never}
              className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft"
            >
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
                    isSpeaking={activeSpeakerIdentities.has(localParticipantCard.identity)}
                    className="min-h-[160px] sm:min-h-[180px]"
                  />
                ) : null}
                {(role === "teacher" ? studentTiles : remoteParticipants).map((participant) => (
                  <VideoTile
                    key={participant.identity}
                    stream={participant.stream}
                    title={participant.name}
                    subtitle={participant.isTeacher ? "Teacher" : "Student"}
                    isSpeaking={activeSpeakerIdentities.has(participant.identity)}
                    className="min-h-[160px] sm:min-h-[180px]"
                  />
                ))}
                {!remoteParticipants.length ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600"
                  >
                    Participant video tiles will appear here when others join the room.
                  </motion.div>
                ) : null}
              </div>
            </motion.section>

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
    </motion.main>
  );
}
