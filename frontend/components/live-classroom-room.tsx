"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { LoadingPanel, Spinner } from "@/components/ui-state";
import { VideoTile } from "@/components/video-tile";
import { usePageTitle } from "@/hooks/use-page-title";
import { getSession, type SessionUser, type UserRole } from "@/lib/demo-auth";
import {
  fetchClassSession,
  getWebSocketUrl,
  uploadRecording,
  type LiveClassSession,
} from "@/lib/api";

type ClassroomRole = Extract<UserRole, "teacher" | "student">;

type Participant = {
  participant_id: string;
  name: string;
  email: string;
  role: ClassroomRole;
};

type LiveClassroomRoomProps = {
  classId: string;
  role: ClassroomRole;
};

const rtcConfiguration: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function LiveClassroomRoom({
  classId,
  role,
}: LiveClassroomRoomProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [classroom, setClassroom] = useState<LiveClassSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>(
    {},
  );
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [selfParticipantId, setSelfParticipantId] = useState("");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [recordingSuccess, setRecordingSuccess] = useState("");

  const initializedRef = useRef(false);
  const isMountedRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const manualDisconnectRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const pendingStopResolveRef = useRef<(() => void) | null>(null);

  const dashboardPath =
    role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
  const titlePrefix = role === "teacher" ? "Teacher Classroom" : "Student Classroom";

  usePageTitle(
    classroom ? `${titlePrefix} - ${classroom.title}` : `${titlePrefix} Loading`,
  );

  const remoteParticipantStreams = useMemo(() => {
    return participants
      .filter(
        (participant) =>
          participant.participant_id !== selfParticipantId &&
          Boolean(remoteStreams[participant.participant_id]),
      )
      .map((participant) => ({
        participant,
        stream: remoteStreams[participant.participant_id],
      }));
  }, [participants, remoteStreams, selfParticipantId]);

  const teacherStreamCard =
    role === "student"
      ? remoteParticipantStreams.find((item) => item.participant.role === "teacher")
      : null;

  async function refreshClassroomSession() {
    try {
      const latestClassroom = await fetchClassSession(classId);

      if (isMountedRef.current) {
        setClassroom(latestClassroom);
      }
    } catch {
      return;
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

    try {
      const fileExtension = blob.type.includes("webm") ? "webm" : "bin";
      const recordingFile = new File(
        [blob],
        `${classId}-${Date.now()}.${fileExtension}`,
        {
          type: blob.type || "video/webm",
        },
      );

      await uploadRecording({
        classId,
        teacherName: session.name,
        title: classroom.title,
        file: recordingFile,
      });
      setRecordingSuccess("Recording saved successfully for students to watch later.");
    } catch (requestError) {
      setRecordingError(
        requestError instanceof Error
          ? requestError.message
          : "Recording upload failed.",
      );
    } finally {
      setIsUploadingRecording(false);
    }
  }

  function startRecording() {
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
          setRecordingError("No recording data was captured.");
        }

        pendingStopResolveRef.current?.();
        pendingStopResolveRef.current = null;
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
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

  function cleanupPeerConnection(participantId: string) {
    const peerConnection = peersRef.current.get(participantId);

    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
      peersRef.current.delete(participantId);
    }

    pendingIceRef.current.delete(participantId);
    setRemoteStreams((currentStreams) => {
      const nextStreams = { ...currentStreams };
      delete nextStreams[participantId];
      return nextStreams;
    });
  }

  function cleanupMediaAndConnections() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    for (const participantId of peersRef.current.keys()) {
      cleanupPeerConnection(participantId);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
    }

    localStreamRef.current = null;
    setLocalStream(null);
  }

  function sendSignal(payload: Record<string, unknown>) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify(payload));
  }

  async function flushPendingIce(participantId: string) {
    const peerConnection = peersRef.current.get(participantId);
    const pendingCandidates = pendingIceRef.current.get(participantId);

    if (!peerConnection || !pendingCandidates?.length || !peerConnection.remoteDescription) {
      return;
    }

    for (const candidate of pendingCandidates) {
      await peerConnection.addIceCandidate(candidate);
    }

    pendingIceRef.current.delete(participantId);
  }

  function ensurePeerConnection(participant: Participant) {
    const existingConnection = peersRef.current.get(participant.participant_id);

    if (existingConnection) {
      return existingConnection;
    }

    const peerConnection = new RTCPeerConnection(rtcConfiguration);

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        peerConnection.addTrack(track, localStreamRef.current);
      }
    }

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      sendSignal({
        type: "ice-candidate",
        target_id: participant.participant_id,
        data: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStreams((currentStreams) => ({
        ...currentStreams,
        [participant.participant_id]: remoteStream,
      }));
    };

    peerConnection.onconnectionstatechange = () => {
      if (
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "closed" ||
        peerConnection.connectionState === "disconnected"
      ) {
        cleanupPeerConnection(participant.participant_id);
      }
    };

    peersRef.current.set(participant.participant_id, peerConnection);
    return peerConnection;
  }

  async function createOfferForParticipant(participant: Participant) {
    if (role !== "teacher") {
      return;
    }

    const peerConnection = ensurePeerConnection(participant);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    sendSignal({
      type: "offer",
      target_id: participant.participant_id,
      data: offer,
    });
  }

  async function handleOffer(sender: Participant, offer: RTCSessionDescriptionInit) {
    const peerConnection = ensurePeerConnection(sender);
    await peerConnection.setRemoteDescription(offer);
    await flushPendingIce(sender.participant_id);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    sendSignal({
      type: "answer",
      target_id: sender.participant_id,
      data: answer,
    });
  }

  async function handleAnswer(
    senderId: string,
    answer: RTCSessionDescriptionInit,
  ) {
    const peerConnection = peersRef.current.get(senderId);

    if (!peerConnection) {
      return;
    }

    await peerConnection.setRemoteDescription(answer);
    await flushPendingIce(senderId);
  }

  async function handleIceCandidate(
    senderId: string,
    candidate: RTCIceCandidateInit,
  ) {
    const peerConnection = peersRef.current.get(senderId);

    if (!peerConnection) {
      const pendingCandidates = pendingIceRef.current.get(senderId) ?? [];
      pendingCandidates.push(candidate);
      pendingIceRef.current.set(senderId, pendingCandidates);
      return;
    }

    if (peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(candidate);
      return;
    }

    const pendingCandidates = pendingIceRef.current.get(senderId) ?? [];
    pendingCandidates.push(candidate);
    pendingIceRef.current.set(senderId, pendingCandidates);
  }

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    async function initializeRoom() {
      const storedSession = getSession();

      if (!storedSession || storedSession.role !== role) {
        router.replace("/login");
        return;
      }

      setSession(storedSession);

      try {
        const classroomSession = await fetchClassSession(classId);

        if (role === "student" && classroomSession.status !== "live") {
          setError("No live session found right now.");
          setIsLoading(false);
          return;
        }

        setClassroom(classroomSession);

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!isMountedRef.current) {
          for (const track of mediaStream.getTracks()) {
            track.stop();
          }
          return;
        }

        localStreamRef.current = mediaStream;
        setLocalStream(mediaStream);

        const websocket = new WebSocket(
          getWebSocketUrl(`/ws/classroom/${classId}`),
        );

        websocket.onopen = () => {
          websocket.send(
            JSON.stringify({
              type: "join",
              role,
              name: storedSession.name,
              email: storedSession.email,
            }),
          );
          setIsLoading(false);
        };

        websocket.onmessage = async (event) => {
          const message = JSON.parse(event.data) as {
            type: string;
            participant_id?: string;
            participants?: Participant[];
            participant?: Participant;
            sender_id?: string;
            sender?: Participant;
            data?: RTCSessionDescriptionInit | RTCIceCandidateInit;
            message?: string;
          };

          if (message.type === "error") {
            setError(message.message ?? "Connection error.");
            return;
          }

          if (message.type === "joined") {
            const nextParticipants = message.participants ?? [];
            setSelfParticipantId(message.participant_id ?? "");
            setParticipants(nextParticipants);
            await refreshClassroomSession();

            if (role === "teacher") {
              for (const participant of nextParticipants) {
                if (participant.role === "student") {
                  await createOfferForParticipant(participant);
                }
              }
            }
            return;
          }

          if (message.type === "participant-joined" && message.participant) {
            setParticipants((currentParticipants) => {
              if (!message.participant) {
                return currentParticipants;
              }

              const filteredParticipants = currentParticipants.filter(
                (participant) =>
                  participant.participant_id !== message.participant?.participant_id,
              );
              return [...filteredParticipants, message.participant];
            });
            await refreshClassroomSession();

            if (role === "teacher" && message.participant.role === "student") {
              await createOfferForParticipant(message.participant);
            }
            return;
          }

          if (message.type === "participant-left" && message.participant_id) {
            cleanupPeerConnection(message.participant_id);
            setParticipants((currentParticipants) =>
              currentParticipants.filter(
                (participant) => participant.participant_id !== message.participant_id,
              ),
            );
            await refreshClassroomSession();
            return;
          }

          if (message.type === "offer" && message.sender && message.data) {
            await handleOffer(
              message.sender,
              message.data as RTCSessionDescriptionInit,
            );
            return;
          }

          if (message.type === "answer" && message.sender_id && message.data) {
            await handleAnswer(
              message.sender_id,
              message.data as RTCSessionDescriptionInit,
            );
            return;
          }

          if (message.type === "ice-candidate" && message.sender_id && message.data) {
            await handleIceCandidate(
              message.sender_id,
              message.data as RTCIceCandidateInit,
            );
            return;
          }

          if (message.type === "room-ended") {
            setStatusMessage(message.message ?? "The class session has ended.");
            manualDisconnectRef.current = true;
            cleanupMediaAndConnections();
            window.setTimeout(() => {
              router.replace(dashboardPath);
            }, 1600);
          }
        };

        websocket.onclose = () => {
          if (!manualDisconnectRef.current && isMountedRef.current) {
            setStatusMessage("Connection lost. Please return to the dashboard.");
          }
        };

        wsRef.current = websocket;
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
      manualDisconnectRef.current = true;
      cleanupMediaAndConnections();
    };
  }, [classId, dashboardPath, role, router]);

  async function handleLeaveOrEndClass() {
    manualDisconnectRef.current = true;

    if (role === "teacher" && isRecording) {
      await stopRecording();
    }

    if (role === "teacher") {
      sendSignal({ type: "end-class" });
    }

    cleanupMediaAndConnections();
    router.push(dashboardPath);
  }

  function toggleMic() {
    if (!localStreamRef.current) {
      return;
    }

    const nextEnabled = !micEnabled;

    for (const track of localStreamRef.current.getAudioTracks()) {
      track.enabled = nextEnabled;
    }

    setMicEnabled(nextEnabled);
  }

  function toggleCamera() {
    if (!localStreamRef.current) {
      return;
    }

    const nextEnabled = !cameraEnabled;

    for (const track of localStreamRef.current.getVideoTracks()) {
      track.enabled = nextEnabled;
    }

    setCameraEnabled(nextEnabled);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
          <LoadingPanel
            title="Joining classroom"
            message="We are preparing your camera, microphone, and live class session."
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
                {classroom.participants_count} participants
              </div>
            </div>
          </div>
        </header>

        {statusMessage ? (
          <div className="mt-6 rounded-[1.5rem] border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-700">
            {statusMessage}
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
                  {role === "teacher" ? "Host controls active" : "Connected classroom"}
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
                    ? remoteParticipantStreams[0]?.stream ?? null
                    : teacherStreamCard?.stream ?? null
                }
                title={
                  role === "teacher"
                    ? remoteParticipantStreams[0]?.participant.name ?? "Waiting for students"
                    : teacherStreamCard?.participant.name ?? classroom.teacher_name
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
                onClick={toggleMic}
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
                onClick={toggleCamera}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
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
                  onClick={isRecording ? () => void stopRecording() : startRecording}
                  disabled={isUploadingRecording}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto ${
                    isRecording
                      ? "bg-amber-100 text-amber-800"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {isUploadingRecording ? (
                    <Spinner className="h-4 w-4" />
                  ) : null}
                  {isRecording ? "Stop Recording" : "Record"}
                </button>
              ) : null}
              {role === "student" ? (
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
                >
                  Raise Hand
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

            {role === "teacher" ? (
              <div className="mt-6 rounded-[2rem] border border-slate-100 bg-slate-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
                  Recordings
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Recording tools will connect here after the live video MVP is stable.
                </p>
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
                  {participants.map((participant) => (
                    <div
                      key={participant.participant_id}
                      className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700"
                    >
                      {participant.name}
                      {participant.participant_id === selfParticipantId ? " (You)" : ""}
                    </div>
                  ))}
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

            {role === "teacher" ? (
              <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
                  Student Tiles
                </p>
                <div className="mt-5 grid gap-4">
                  <VideoTile
                    stream={localStream}
                    title={session.name}
                    subtitle="Your camera"
                    muted
                    className="min-h-[160px] sm:min-h-[180px]"
                  />
                  {remoteParticipantStreams.map(({ participant, stream }) => (
                    <VideoTile
                      key={participant.participant_id}
                      stream={stream}
                      title={participant.name}
                      subtitle="Student"
                      className="min-h-[160px] sm:min-h-[180px]"
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">
                Chat
              </p>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  Teacher: Welcome to class
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  {session.name}: Camera and mic are ready
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
