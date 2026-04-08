"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50/80 to-slate-100/70 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <section className="glass-card rounded-2xl p-5 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                Shared Recording
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
                {recording?.title ?? "Class Recording"}
              </h1>
            </div>
            <Link
              href="/"
              className="premium-button btn-secondary px-4 py-2 text-sm font-semibold"
            >
              Home
            </Link>
          </div>

          {isLoading ? (
            <div className="mt-6 animate-pulse space-y-3">
              <div className="h-64 rounded-2xl bg-slate-100 sm:h-80" />
              <div className="h-5 w-48 rounded bg-slate-100" />
            </div>
          ) : error || !recording ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {error || "This recording is not available."}
            </div>
          ) : playUrl ? (
            <div className="mt-6">
              <div className="group relative overflow-hidden rounded-2xl bg-slate-900">
                <video controls autoPlay className="w-full" src={playUrl} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full border border-white/40 bg-white/20 p-5 backdrop-blur">
                    <span className="block h-0 w-0 border-y-[12px] border-y-transparent border-l-[20px] border-l-white" />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Teacher: {recording.teacher} • Available until{" "}
                {new Date(recording.expires_at).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-600">
              This recording is metadata-only and has no video file attached.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
