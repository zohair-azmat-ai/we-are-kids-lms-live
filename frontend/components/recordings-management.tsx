"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteRecording,
  fetchRecordings,
  getAssetUrl,
  updateRecordingTitle,
  type RecordingItem,
} from "@/lib/api";
import { getRecordingStatus, type RecordingStatus } from "@/lib/recordings";

type RecordingsManagementProps = {
  role: "teacher" | "admin";
  teacherName?: string;
};

function resolvePlayUrl(recording: RecordingItem): string {
  if (recording.cloud_url) return recording.cloud_url;
  if (recording.file_url) {
    try {
      return getAssetUrl(recording.file_url);
    } catch {
      return "";
    }
  }
  return "";
}

function RecordingStatusBadge({ recording }: { recording: RecordingItem }) {
  const status = recording.status ?? "available";
  const statusMap: Record<string, { label: string; className: string }> = {
    recording: { label: "Recording", className: "bg-red-100 text-red-700" },
    processing: { label: "Processing", className: "bg-blue-100 text-blue-700" },
    available: { label: "Available", className: "bg-emerald-100 text-emerald-700" },
    failed_upload: { label: "Upload failed", className: "bg-rose-100 text-rose-700" },
    metadata_only: { label: "Metadata only", className: "bg-slate-100 text-slate-600" },
    "browser-recorded": { label: "Saved", className: "bg-sky-100 text-sky-700" },
  };
  const ui = statusMap[status] ?? getRecordingStatus(recording);
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ui.className}`}>
      {ui.label}
    </span>
  );
}

function VideoPreviewCard({
  recording,
  onClose,
}: {
  recording: RecordingItem;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playUrl = resolvePlayUrl(recording);

  return (
    <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-slate-100 bg-slate-900 shadow-soft">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold text-white">{recording.title}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          Close
        </button>
      </div>
      {playUrl ? (
        <video
          ref={videoRef}
          controls
          autoPlay
          className="w-full"
          src={playUrl}
          style={{ maxHeight: "360px" }}
        />
      ) : (
        <div className="flex items-center justify-center px-6 py-10 text-sm text-white/60">
          No playable video file available for this recording.
        </div>
      )}
    </div>
  );
}

export function RecordingsManagement({
  role,
  teacherName,
}: RecordingsManagementProps) {
  const router = useRouter();
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingRecordingId, setEditingRecordingId] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [busyRecordingId, setBusyRecordingId] = useState("");
  const [previewRecordingId, setPreviewRecordingId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | RecordingStatus>("");

  useEffect(() => {
    async function loadRecordings() {
      try {
        setIsLoading(true);
        setError("");
        const savedRecordings = await fetchRecordings();
        setRecordings(savedRecordings);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load recordings.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadRecordings();
  }, []);

  const teacherScopedRecordings = useMemo(() => {
    if (role !== "teacher") return recordings;
    if (!teacherName) return [];
    return recordings.filter((r) => r.teacher === teacherName);
  }, [recordings, role, teacherName]);

  const filteredRecordings = useMemo(() => {
    return teacherScopedRecordings.filter((recording) => {
      const matchesTeacher =
        role !== "admin" ||
        !teacherFilter ||
        recording.teacher.toLowerCase().includes(teacherFilter.toLowerCase());
      const matchesClass =
        !classFilter ||
        recording.class_id.toLowerCase().includes(classFilter.toLowerCase());
      const matchesStatus =
        !statusFilter || getRecordingStatus(recording).label === statusFilter;
      return matchesTeacher && matchesClass && matchesStatus;
    });
  }, [teacherScopedRecordings, role, teacherFilter, classFilter, statusFilter]);

  const teacherOptions = useMemo(() => {
    return Array.from(new Set(recordings.map((r) => r.teacher))).sort();
  }, [recordings]);

  function openWatch(recordingId: string) {
    router.push(`/${role}/recordings/${recordingId}`);
  }

  function togglePreview(recordingId: string) {
    setPreviewRecordingId((current) => (current === recordingId ? "" : recordingId));
  }

  async function copyShareLink(recording: RecordingItem) {
    const url = resolvePlayUrl(recording);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(recording.recording_id);
      setTimeout(() => setCopiedId(""), 2000);
    } catch {
      setError("Unable to copy to clipboard.");
    }
  }

  function startRename(recording: RecordingItem) {
    setEditingRecordingId(recording.recording_id);
    setDraftTitle(recording.title);
    setSuccessMessage("");
    setError("");
  }

  async function saveRename(recordingId: string) {
    try {
      setBusyRecordingId(recordingId);
      setError("");
      const updated = await updateRecordingTitle(recordingId, draftTitle.trim());
      setRecordings((current) =>
        current.map((r) =>
          r.recording_id === recordingId ? updated.recording : r,
        ),
      );
      setEditingRecordingId("");
      setDraftTitle("");
      setSuccessMessage("Recording title updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to rename recording.",
      );
    } finally {
      setBusyRecordingId("");
    }
  }

  async function removeRecording(recordingId: string) {
    if (!window.confirm("Delete this recording permanently?")) return;
    try {
      setBusyRecordingId(recordingId);
      setError("");
      await deleteRecording(recordingId);
      setRecordings((current) => current.filter((r) => r.recording_id !== recordingId));
      setSuccessMessage("Recording deleted.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete recording.",
      );
    } finally {
      setBusyRecordingId("");
    }
  }

  return (
    <div className="space-y-6">
      {role === "admin" ? (
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
            Filters
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
            >
              <option value="">All teachers</option>
              {teacherOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="text"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              placeholder="Filter by class"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | RecordingStatus)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
            >
              <option value="">All statuses</option>
              <option value="available">Available</option>
              <option value="expires soon">Expires soon</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">
          Recordings Library
        </p>

        {successMessage ? (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-5 animate-pulse space-y-3">
            <div className="h-20 rounded-2xl bg-slate-100" />
            <div className="h-20 rounded-2xl bg-slate-100" />
          </div>
        ) : filteredRecordings.length ? (
          <div className="mt-5 space-y-4">
            {filteredRecordings.map((recording) => {
              const isEditing = editingRecordingId === recording.recording_id;
              const isBusy = busyRecordingId === recording.recording_id;
              const isPreviewing = previewRecordingId === recording.recording_id;
              const playUrl = resolvePlayUrl(recording);
              const hasVideo = Boolean(playUrl);
              const isCopied = copiedId === recording.recording_id;

              return (
                <div
                  key={recording.recording_id}
                  className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5"
                >
                  {/* Header row */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
                          />
                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => void saveRename(recording.recording_id)}
                              disabled={isBusy || !draftTitle.trim()}
                              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingRecordingId(""); setDraftTitle(""); }}
                              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-base font-semibold text-slate-800 leading-snug">
                          {recording.title}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {role === "admin" ? <span>Teacher: {recording.teacher}</span> : null}
                        <span>Created: {new Date(recording.created_at).toLocaleDateString()}</span>
                        <span>Expires: {new Date(recording.expires_at).toLocaleDateString()}</span>
                        {!hasVideo ? (
                          <span className="text-slate-400">No video file</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <RecordingStatusBadge recording={recording} />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {hasVideo ? (
                      <button
                        type="button"
                        onClick={() => togglePreview(recording.recording_id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                          isPreviewing
                            ? "bg-slate-800 text-white"
                            : "bg-blue-600 text-white shadow-sm shadow-blue-100"
                        }`}
                      >
                        {isPreviewing ? "Hide Preview" : "Play"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openWatch(recording.recording_id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyShareLink(recording)}
                      disabled={!hasVideo}
                      title={hasVideo ? "Copy share link" : "No file available to share"}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                        hasVideo
                          ? isCopied
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {isCopied ? "Copied!" : "Copy Link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startRename(recording)}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeRecording(recording.recording_id)}
                      disabled={isBusy}
                      className="inline-flex items-center rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-100 transition active:scale-95 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Inline video preview */}
                  {isPreviewing ? (
                    <VideoPreviewCard
                      recording={recording}
                      onClose={() => setPreviewRecordingId("")}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            No recordings match the current view.
          </div>
        )}
      </section>
    </div>
  );
}
