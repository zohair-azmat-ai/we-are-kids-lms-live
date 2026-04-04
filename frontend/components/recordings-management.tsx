"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteRecording,
  fetchRecordings,
  updateRecordingTitle,
  type RecordingItem,
} from "@/lib/api";
import { getRecordingStatus, type RecordingStatus } from "@/lib/recordings";

type RecordingsManagementProps = {
  role: "teacher" | "admin";
  teacherName?: string;
};

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
    if (role !== "teacher") {
      return recordings;
    }

    if (!teacherName) {
      return [];
    }

    return recordings.filter((recording) => recording.teacher === teacherName);
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
    return Array.from(new Set(recordings.map((recording) => recording.teacher))).sort();
  }, [recordings]);

  function openWatch(recordingId: string) {
    router.push(`/${role}/recordings/${recordingId}`);
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
      setRecordings((currentRecordings) =>
        currentRecordings.map((recording) =>
          recording.recording_id === recordingId ? updated.recording : recording,
        ),
      );
      setEditingRecordingId("");
      setDraftTitle("");
      setSuccessMessage("Recording title updated successfully.");
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
    const confirmed = window.confirm(
      "Are you sure you want to delete this recording permanently?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setBusyRecordingId(recordingId);
      setError("");
      await deleteRecording(recordingId);
      setRecordings((currentRecordings) =>
        currentRecordings.filter((recording) => recording.recording_id !== recordingId),
      );
      setSuccessMessage("Recording deleted successfully.");
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
              onChange={(event) => setTeacherFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 outline-none"
            >
              <option value="">All teachers</option>
              {teacherOptions.map((teacher) => (
                <option key={teacher} value={teacher}>
                  {teacher}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              placeholder="Filter by class id"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 outline-none placeholder:text-slate-400"
            />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "" | RecordingStatus)
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700 outline-none"
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
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
            Loading recordings...
          </div>
        ) : filteredRecordings.length ? (
          <div className="mt-5 space-y-4">
            {filteredRecordings.map((recording) => {
              const status = getRecordingStatus(recording);
              const isEditing = editingRecordingId === recording.recording_id;
              const isBusy = busyRecordingId === recording.recording_id;

              return (
                <div
                  key={recording.recording_id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <input
                            type="text"
                            value={draftTitle}
                            onChange={(event) => setDraftTitle(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void saveRename(recording.recording_id)}
                              disabled={isBusy || !draftTitle.trim()}
                              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRecordingId("");
                                setDraftTitle("");
                              }}
                              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-lg font-semibold text-slate-800">
                          {recording.title}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                        {role === "admin" ? <span>Teacher: {recording.teacher}</span> : null}
                        <span>Class: {recording.class_id}</span>
                        <span>
                          Created: {new Date(recording.created_at).toLocaleDateString()}
                        </span>
                        <span>
                          Expires: {new Date(recording.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <div
                        className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${status.className}`}
                      >
                        {status.label}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openWatch(recording.recording_id)}
                          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-100"
                        >
                          Watch
                        </button>
                        <button
                          type="button"
                          onClick={() => startRename(recording)}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeRecording(recording.recording_id)}
                          disabled={isBusy}
                          className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-slate-700">
            No recordings match the current view.
          </div>
        )}
      </section>
    </div>
  );
}
