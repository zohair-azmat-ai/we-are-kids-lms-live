"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { fetchPublicRecording, getAssetUrl, type RecordingItem } from "@/lib/api";

function resolvePlayUrl(recording: RecordingItem): string {
  if (recording.cloud_url) {
    return recording.cloud_url;
  }
  if (!recording.file_url) {
    return "";
  }
  try {
    return getAssetUrl(recording.file_url);
  } catch {
    return "";
  }
}

export default function PublicRecordingPage() {
  const params = useParams<{ recordingId: string }>();
  const [recording, setRecording] = useState<RecordingItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRecording() {
      try {
        setIsLoading(true);
        setError("");
        const response = await fetchPublicRecording(params.recordingId);
        setRecording(response);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "This recording could not be loaded.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadRecording();
  }, [params.recordingId]);

  const playUrl = recording ? resolvePlayUrl(recording) : "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-soft sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                Shared Recording
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-800 sm:text-3xl">
                {recording?.title ?? "Class Recording"}
              </h1>
            </div>
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Home
            </Link>
          </div>

          {isLoading ? (
            <div className="mt-6 animate-pulse space-y-3">
              <div className="h-64 rounded-[1.5rem] bg-slate-100 sm:h-80" />
              <div className="h-5 w-48 rounded bg-slate-100" />
            </div>
          ) : error || !recording ? (
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-700">
              {error || "This recording is not available."}
            </div>
          ) : playUrl ? (
            <div className="mt-6">
              <div className="overflow-hidden rounded-[1.5rem] bg-slate-900">
                <video controls autoPlay className="w-full" src={playUrl} />
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Teacher: {recording.teacher} • Available until{" "}
                {new Date(recording.expires_at).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              This recording is metadata-only and has no video file attached.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
