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

function HandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
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

type ChatMessage = {
  id: string;
  senderIdentity: string;
  senderName: string;
  text: string;
  timestamp: number;
  isTeacher: boolean;
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
  // Raise hand
  const [handRaisedByMe, setHandRaisedByMe] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Map<string, string>>(new Map()); // identity → name
  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  // Screen share
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [remoteScreenShareStream, setRemoteScreenShareStream] = useState<MediaStream | null>(null);
  // Smart moderation
  const [noisyParticipants, setNoisyParticipants] = useState<Set<string>>(new Set()); // identity
  const [mutedByTeacher, setMutedByTeacher] = useState<Set<string>>(new Set()); // identity

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
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Map: track.sid → { analyser, identity }
  const audioAnalysersRef = useRef<Map<string, { analyser: AnalyserNode; identity: string }>>(new Map());
  // Map: identity → consecutive-noisy-sample count
  const noiseCountersRef = useRef<Map<string, number>>(new Map());
  // Map: identity → mute cooldown (timestamp ms)
  const muteCooldownRef = useRef<Map<string, number>>(new Map());
  const noiseIntervalRef = useRef<number | null>(null);

  const dashboardPath =
    role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";

  // True when a teacher joins a class they did not start (co-teacher)
  const isCoTeacher =
    role === "teacher" &&
    !!session &&
    !!classroom &&
    session.email !== classroom.teacher_email;

  const titlePrefix = role !== "teacher"
    ? "Student Classroom"
    : isCoTeacher
      ? "Co-Teacher Classroom"
      : "Teacher Classroom";

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
          .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: unknown, participant: Participant) => {
            if (track.kind === Track.Kind.Audio && track.mediaStreamTrack && track.sid) {
              const audioEl = document.createElement("audio");
              audioEl.srcObject = new MediaStream([track.mediaStreamTrack]);
              audioEl.autoplay = true;
              void audioEl.play().catch(() => {
                // Autoplay blocked — user must tap "Enable Audio"
              });
              document.body.appendChild(audioEl);
              audioElementsRef.current.set(track.sid, audioEl);

              // Wire up AnalyserNode for noise detection
              try {
                if (!audioContextRef.current) {
                  audioContextRef.current = new AudioContext();
                }
                const ctx = audioContextRef.current;
                const source = ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                audioAnalysersRef.current.set(track.sid, { analyser, identity: participant.identity });
              } catch {
                // AudioContext not available — moderation disabled
              }
            } else if (
              track.source === Track.Source.ScreenShare &&
              track.mediaStreamTrack
            ) {
              setRemoteScreenShareStream(new MediaStream([track.mediaStreamTrack]));
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
              audioAnalysersRef.current.delete(track.sid);
            } else if (track.source === Track.Source.ScreenShare) {
              setRemoteScreenShareStream(null);
            }
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.LocalTrackPublished, (publication) => {
            if (
              publication.source === Track.Source.ScreenShare &&
              publication.track?.mediaStreamTrack
            ) {
              setScreenShareStream(new MediaStream([publication.track.mediaStreamTrack]));
              setIsScreenSharing(true);
            }
            syncRoomState(room, classroomRef.current);
          })
          .on(RoomEvent.LocalTrackUnpublished, (publication) => {
            if (publication.source === Track.Source.ScreenShare) {
              setScreenShareStream(null);
              setIsScreenSharing(false);
            }
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
              const parsed = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;

              if (parsed.type === "mute-request") {
                const targetIdentity = parsed.targetIdentity as string;
                // Only mute ourselves if we are the target and we're a student
                if (session?.email === targetIdentity && role === "student") {
                  void (async () => {
                    try {
                      await roomRef.current?.localParticipant.setMicrophoneEnabled(false);
                      setMicEnabled(false);
                      setMutedByTeacher((prev) => new Set([...prev, targetIdentity]));
                    } catch {
                      // ignore
                    }
                  })();
                }
              } else if (parsed.type === "room-ended") {
                handleRemoteRoomEnded(
                  (parsed.message as string | undefined) ?? "The teacher ended this class session.",
                );
              } else if (parsed.type === "raise-hand") {
                const identity = parsed.identity as string;
                const name = parsed.name as string;
                const raised = parsed.raised as boolean;
                setRaisedHands((prev) => {
                  const next = new Map(prev);
                  if (raised) {
                    next.set(identity, name);
                  } else {
                    next.delete(identity);
                  }
                  return next;
                });
              } else if (parsed.type === "chat") {
                const msg: ChatMessage = {
                  id: parsed.id as string,
                  senderIdentity: parsed.senderIdentity as string,
                  senderName: parsed.senderName as string,
                  text: parsed.text as string,
                  timestamp: parsed.timestamp as number,
                  isTeacher: parsed.isTeacher as boolean,
                };
                setChatMessages((prev) => [...prev, msg]);
                setUnreadChat((n) => n + 1);
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

      // Cleanup noise detection
      if (noiseIntervalRef.current) {
        window.clearInterval(noiseIntervalRef.current);
        noiseIntervalRef.current = null;
      }
      audioAnalysersRef.current.clear();
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [classId, role, router, user, isAuthLoading]);

  // Noise detection — teacher-side only, runs every 800ms
  useEffect(() => {
    if (role !== "teacher" || connectionState !== "connected") {
      return;
    }

    const NOISY_THRESHOLD = 0.04;   // RMS amplitude threshold
    const NOISY_COUNT_LIMIT = 4;    // consecutive samples before flagging
    const COOLDOWN_MS = 20_000;     // 20 s between mute actions per participant

    noiseIntervalRef.current = window.setInterval(() => {
      const data = new Float32Array(128);
      const nextNoisy = new Set<string>();

      audioAnalysersRef.current.forEach(({ analyser, identity }) => {
        analyser.getFloatTimeDomainData(data);
        // RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);

        if (rms > NOISY_THRESHOLD) {
          const count = (noiseCountersRef.current.get(identity) ?? 0) + 1;
          noiseCountersRef.current.set(identity, count);
          if (count >= NOISY_COUNT_LIMIT) {
            nextNoisy.add(identity);
          }
        } else {
          // Decay counter when quiet
          const count = Math.max(0, (noiseCountersRef.current.get(identity) ?? 0) - 1);
          noiseCountersRef.current.set(identity, count);
        }
      });

      setNoisyParticipants(nextNoisy);
    }, 800);

    return () => {
      if (noiseIntervalRef.current) {
        window.clearInterval(noiseIntervalRef.current);
        noiseIntervalRef.current = null;
      }
    };
  }, [role, connectionState]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Reset unread count when chat panel is opened
  useEffect(() => {
    if (showChat) {
      setUnreadChat(0);
    }
  }, [showChat]);

  async function requestMuteParticipant(targetIdentity: string) {
    if (!roomRef.current || role !== "teacher") {
      return;
    }

    const now = Date.now();
    const cooldown = muteCooldownRef.current.get(targetIdentity) ?? 0;

    if (now < cooldown) {
      return; // still in cooldown
    }

    muteCooldownRef.current.set(targetIdentity, now + 20_000);

    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: "mute-request", targetIdentity }),
      );
      await roomRef.current.localParticipant.publishData(payload, { reliable: true });

      // Clear the noisy flag for this participant
      setNoisyParticipants((prev) => {
        const next = new Set(prev);
        next.delete(targetIdentity);
        return next;
      });
      noiseCountersRef.current.set(targetIdentity, 0);
    } catch {
      // Non-fatal
    }
  }

  async function toggleRaiseHand() {
    if (!roomRef.current || !session) {
      return;
    }

    const nextRaised = !handRaisedByMe;
    setHandRaisedByMe(nextRaised);

    // Update local raised hands map immediately so teacher sees own state
    setRaisedHands((prev) => {
      const next = new Map(prev);
      if (nextRaised) {
        next.set(session.email, session.name);
      } else {
        next.delete(session.email);
      }
      return next;
    });

    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: "raise-hand",
          identity: session.email,
          name: session.name,
          raised: nextRaised,
        }),
      );
      await roomRef.current.localParticipant.publishData(payload, { reliable: true });
    } catch {
      // Non-fatal — just revert local state
      setHandRaisedByMe(!nextRaised);
    }
  }

  async function sendChatMessage() {
    if (!roomRef.current || !session || !chatInput.trim()) {
      return;
    }

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      senderIdentity: session.email,
      senderName: session.name,
      text: chatInput.trim(),
      timestamp: Date.now(),
      isTeacher: role === "teacher",
    };

    setChatMessages((prev) => [...prev, msg]);
    setChatInput("");

    try {
      const payload = new TextEncoder().encode(JSON.stringify({ type: "chat", ...msg }));
      await roomRef.current.localParticipant.publishData(payload, { reliable: true });
    } catch {
      // Message already added locally; remote delivery failed silently
    }
  }

  async function toggleScreenShare() {
    if (!roomRef.current) {
      return;
    }

    try {
      if (isScreenSharing) {
        await roomRef.current.localParticipant.setScreenShareEnabled(false);
        // State cleared via LocalTrackUnpublished event
      } else {
        await roomRef.current.localParticipant.setScreenShareEnabled(true);
        // State set via LocalTrackPublished event
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setDeviceMessage("Screen share permission was denied.");
      } else {
        setDeviceMessage("Screen sharing is not supported in this browser.");
      }
    }
  }

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
      if (role === "teacher" && !isCoTeacher) {
        // Primary teacher: broadcast end-class to all and mark session ended
        await publishRoomEndedNotice();
        await endLiveClass(classId, session.email);
      } else {
        // Co-teacher or student: just leave quietly
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

  // Active-speaker auto-focus: promote the speaking participant to the main tile
  const focusedRemote = useMemo(() => {
    if (remoteScreenShareStream || screenShareStream) {
      return null; // screen share takes over the main tile
    }
    if (role === "teacher") {
      const speaking = studentTiles.find((p) => activeSpeakerIdentities.has(p.identity));
      return speaking ?? studentTiles[0] ?? null;
    }
    return teacherStreamCard ?? null;
  }, [role, studentTiles, activeSpeakerIdentities, teacherStreamCard, remoteScreenShareStream, screenShareStream]);

  const mainTileIdentity = focusedRemote?.identity;

  return (
    <>
      {/* ── Participants overlay — rendered OUTSIDE motion.main so that
          framer-motion's transform on the parent cannot become a containing
          block for these fixed-position children ──────────────────────── */}
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
                      const hasHand = raisedHands.has(participant.identity);
                      const showMic = participant.isLocal ? micEnabled : participant.micEnabled;
                      const showCam = participant.isLocal ? cameraEnabled : participant.cameraEnabled;

                      return (
                        <motion.li
                          key={participant.identity}
                          variants={fadeUp}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
                            hasHand
                              ? "border-amber-200 bg-amber-50"
                              : isSpeaking
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
                              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                                {participant.name}
                                {participant.isLocal ? (
                                  <span className="text-xs font-normal text-slate-400">(You)</span>
                                ) : null}
                                <AnimatePresence>
                                  {hasHand ? (
                                    <motion.span
                                      key="hand"
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      exit={{ scale: 0 }}
                                    >
                                      ✋
                                    </motion.span>
                                  ) : null}
                                </AnimatePresence>
                              </p>
                              <p className={`text-xs ${isSpeaking ? "text-green-600" : hasHand ? "text-amber-600" : "text-slate-400"}`}>
                                {isSpeaking
                                  ? "Speaking..."
                                  : hasHand
                                    ? "Hand raised"
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

      {/* ── Raised hands queue (teacher only, fixed overlay) ──────────────── */}
      <AnimatePresence>
        {role === "teacher" && raisedHands.size > 0 ? (
          <motion.div
            key="raised-hands"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-6 left-4 z-50 w-64 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-4 shadow-2xl sm:left-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
              ✋ Raised Hands ({raisedHands.size})
            </p>
            <ul className="mt-3 space-y-2">
              {Array.from(raisedHands.entries()).map(([identity, name]) => (
                <li key={identity} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm">
                  <span className="text-base">✋</span>
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Chat panel (fixed overlay outside motion.main) ────────────────── */}
      <AnimatePresence>
        {showChat ? (
          <>
            <motion.div
              key="chat-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:hidden"
              onClick={() => setShowChat(false)}
            />
            <motion.div
              key="chat-panel"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[360px] sm:rounded-l-[2rem]"
            >
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-600">
                    Class Chat
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{chatMessages.length} messages</p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setShowChat(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                  aria-label="Close chat"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </motion.button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <ChatIcon className="h-10 w-10 text-slate-300" />
                    <p className="text-sm text-slate-500">No messages yet.</p>
                    <p className="text-xs text-slate-400">Be the first to say something!</p>
                  </div>
                ) : (
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                  >
                    {chatMessages.map((msg) => {
                      const isOwn = msg.senderIdentity === session?.email;
                      return (
                        <motion.div
                          key={msg.id}
                          variants={fadeUp}
                          className={`flex flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1.5">
                            {msg.isTeacher ? (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                Teacher
                              </span>
                            ) : null}
                            <span className="text-xs text-slate-400">{msg.senderName}</span>
                          </div>
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                              isOwn
                                ? "bg-blue-600 text-white"
                                : msg.isTeacher
                                  ? "border border-blue-200 bg-blue-50 text-slate-800"
                                  : "border border-slate-100 bg-slate-50 text-slate-700"
                            }`}
                          >
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-slate-100 px-4 py-4">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendChatMessage();
                      }
                    }}
                    placeholder="Type a message…"
                    className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    onClick={() => void sendChatMessage()}
                    disabled={!chatInput.trim()}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <motion.main
        className="min-h-screen"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
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
              {isCoTeacher ? (
                <div className="inline-flex rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
                  Co-Teacher
                </div>
              ) : null}
              <div className="inline-flex rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
                {connectionState}
              </div>
              <AnimatePresence>
                {role === "teacher" && !isCoTeacher && isRecording ? (
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

          {role === "student" && mutedByTeacher.size > 0 && !micEnabled ? (
            <motion.div
              key="muted-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800"
            >
              Your microphone was muted by the teacher to reduce background noise. You can unmute yourself when ready.
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

            {/* Main video tile — screen share takes priority, then active speaker */}
            <div className="mt-6">
              {remoteScreenShareStream ?? screenShareStream ? (
                <div className="overflow-hidden rounded-[2rem] bg-slate-900">
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(el) => {
                      if (el) {
                        el.srcObject = remoteScreenShareStream ?? screenShareStream;
                      }
                    }}
                    className="h-full min-h-[280px] w-full object-contain sm:min-h-[360px] lg:min-h-[420px]"
                  />
                  <div className="bg-slate-800 px-4 py-2 text-center text-xs font-semibold text-slate-300">
                    {isScreenSharing ? "You are sharing your screen" : "Screen share from presenter"}
                  </div>
                </div>
              ) : (
                <VideoTile
                  stream={focusedRemote?.stream ?? null}
                  title={focusedRemote?.name ?? (role === "teacher" ? "Waiting for students" : classroom.teacher_name)}
                  subtitle={
                    role === "teacher"
                      ? focusedRemote
                        ? activeSpeakerIdentities.has(focusedRemote.identity)
                          ? "Speaking now"
                          : "Student video"
                        : "No students yet"
                      : "Teacher live stream"
                  }
                  priority
                  isSpeaking={mainTileIdentity ? activeSpeakerIdentities.has(mainTileIdentity) : false}
                  className="min-h-[280px] sm:min-h-[360px] lg:min-h-[420px]"
                />
              )}
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

              {/* Chat */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={() => setShowChat((prev) => !prev)}
                title="Class chat"
                className={`relative flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                  showChat
                    ? "bg-violet-100 text-violet-600"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <ChatIcon className="h-5 w-5" />
                {unreadChat > 0 && !showChat ? (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unreadChat > 9 ? "9+" : unreadChat}
                  </span>
                ) : null}
                <span className="text-[10px] font-medium leading-none">Chat</span>
              </motion.button>

              {/* Raise Hand (students) */}
              {role === "student" ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  onClick={() => void toggleRaiseHand()}
                  title={handRaisedByMe ? "Lower hand" : "Raise hand"}
                  className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                    handRaisedByMe
                      ? "bg-amber-100 text-amber-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <HandIcon className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-none">
                    {handRaisedByMe ? "Lower Hand" : "Raise Hand"}
                  </span>
                </motion.button>
              ) : null}

              {/* Screen Share (teachers only) */}
              {role === "teacher" ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  onClick={() => void toggleScreenShare()}
                  title={isScreenSharing ? "Stop sharing" : "Share screen"}
                  className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                    isScreenSharing
                      ? "bg-sky-100 text-sky-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <MonitorIcon className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-none">
                    {isScreenSharing ? "Stop Share" : "Share"}
                  </span>
                </motion.button>
              ) : null}

              {/* Record (primary teacher only — not co-teacher) */}
              {role === "teacher" && !isCoTeacher ? (
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
                  {role === "teacher" && !isCoTeacher ? "End Class" : "Leave"}
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
                    studentTiles.map((participant) => {
                      const hasHandRaised = raisedHands.has(participant.identity);
                      const isNoisy = noisyParticipants.has(participant.identity);
                      const isSpeaking = activeSpeakerIdentities.has(participant.identity);
                      return (
                        <motion.div
                          key={participant.identity}
                          variants={fadeUp}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                            isNoisy && !isSpeaking
                              ? "border-red-200 bg-red-50"
                              : hasHandRaised
                                ? "border-amber-200 bg-amber-50"
                                : "border-slate-100 bg-slate-50"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {isSpeaking ? (
                              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500" />
                            ) : (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                            )}
                            <span className="truncate text-sm text-slate-700">{participant.name}</span>
                            <AnimatePresence>
                              {isNoisy && !isSpeaking ? (
                                <motion.span
                                  key="noise"
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600"
                                >
                                  Noise
                                </motion.span>
                              ) : hasHandRaised ? (
                                <motion.span
                                  key="hand"
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  className="shrink-0 text-base"
                                >
                                  ✋
                                </motion.span>
                              ) : null}
                            </AnimatePresence>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 pl-2">
                            {participant.micEnabled
                              ? <MicIcon className="h-4 w-4 text-emerald-500" />
                              : <MicOffIcon className="h-4 w-4 text-red-400" />}
                            {participant.cameraEnabled
                              ? <VideoOnIcon className="h-4 w-4 text-emerald-500" />
                              : <VideoOffIcon className="h-4 w-4 text-slate-400" />}
                            {participant.micEnabled ? (
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.88 }}
                                onClick={() => void requestMuteParticipant(participant.identity)}
                                title="Mute this student"
                                className="rounded-lg bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-200 transition-colors"
                              >
                                Mute
                              </motion.button>
                            ) : null}
                          </div>
                        </motion.div>
                      );
                    })
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
    </>
  );
}
