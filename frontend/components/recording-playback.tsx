"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { LoadingPanel } from "@/components/ui-state";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  fetchRecording,
  fetchRecordingIntelligence,
  regenerateRecordingIntelligence,
  getAssetUrl,
  type RecordingIntelligence,
  type RecordingItem,
} from "@/lib/api";

type RecordingPlaybackProps = {
  allowedRole: "teacher" | "admin" | "student";
  title: string;
  subtitle: string;
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

export function RecordingPlayback({
  allowedRole,
  title,
  subtitle,
}: RecordingPlaybackProps) {
  const params = useParams<{ recordingId: string }>();
  const { user } = useAuth();
  const [recording, setRecording] = useState<RecordingItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [intelligence, setIntelligence] = useState<RecordingIntelligence | null>(null);
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const intelligencePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  usePageTitle(recording ? recording.title : title);

  useEffect(() => {
    async function loadRecording() {
      try {
        setIsLoading(true);
        const recordingItem = await fetchRecording(params.recordingId);

        if (allowedRole === "teacher") {
          if (!user || !["teacher", "main_teacher", "assistant_teacher"].includes(user.role)) {
            setError("Unable to verify teacher access for this recording.");
            setRecording(null);
            return;
          }

          if (recordingItem.teacher !== user.name) {
            setError("You can only watch your own recordings.");
            setRecording(null);
            return;
          }
        }

        setRecording(recordingItem);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load recording.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadRecording();
  }, [params.recordingId, allowedRole, user]);

  // Load and poll intelligence until completed/failed
  const loadIntelligence = useCallback(async (recordingId: string) => {
    try {
      setIsLoadingIntelligence(true);
      const data = await fetchRecordingIntelligence(recordingId);
      setIntelligence(data);

      // Poll while still processing
      if (data.processing_status === "pending" || data.processing_status === "processing") {
        if (!intelligencePollRef.current) {
          intelligencePollRef.current = setInterval(async () => {
            try {
              const updated = await fetchRecordingIntelligence(recordingId);
              setIntelligence(updated);
              if (updated.processing_status === "completed" || updated.processing_status === "failed") {
                if (intelligencePollRef.current) {
                  clearInterval(intelligencePollRef.current);
                  intelligencePollRef.current = null;
                }
              }
            } catch {
              // ignore poll errors
            }
          }, 4000);
        }
      }
    } catch {
      // Non-fatal — intelligence panel just stays hidden
    } finally {
      setIsLoadingIntelligence(false);
    }
  }, [intelligencePollRef]);

  useEffect(() => {
    if (recording?.recording_id && allowedRole !== "student") {
      void loadIntelligence(recording.recording_id);
    }
    return () => {
      if (intelligencePollRef.current) {
        clearInterval(intelligencePollRef.current);
        intelligencePollRef.current = null;
      }
    };
  }, [recording?.recording_id, allowedRole, loadIntelligence]);

  async function handleRegenerate() {
    if (!recording) return;
    try {
      setIsRegenerating(true);
      const data = await regenerateRecordingIntelligence(recording.recording_id);
      setIntelligence(data);
      // Start polling
      if (!intelligencePollRef.current) {
        intelligencePollRef.current = setInterval(async () => {
          try {
            const updated = await fetchRecordingIntelligence(recording.recording_id);
            setIntelligence(updated);
            if (updated.processing_status === "completed" || updated.processing_status === "failed") {
              if (intelligencePollRef.current) {
                clearInterval(intelligencePollRef.current);
                intelligencePollRef.current = null;
              }
            }
          } catch {
            // ignore
          }
        }, 4000);
      }
    } catch {
      // ignore
    } finally {
      setIsRegenerating(false);
    }
  }

  async function copyShareLink() {
    if (!recording) return;
    const shareUrl = `${window.location.origin}/public/recordings/${recording.recording_id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  const playUrl = recording ? resolvePlayUrl(recording) : "";
  const hasVideo = Boolean(playUrl);

  return (
    <DashboardShell
      allowedRole={allowedRole}
      title={title}
      subtitle={subtitle}
    >
      {isLoading ? (
        <LoadingPanel
          title="Loading recording"
          message="Preparing your saved classroom playback."
        />
      ) : error || !recording ? (
        <section className="glass-card rounded-2xl p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <span className="text-lg font-semibold">!</span>
          </div>
          <p className="mt-4 text-lg font-semibold tracking-tight text-slate-800">
            Recording unavailable
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {error || "This recording has expired and can no longer be played."}
          </p>
        </section>
      ) : (
        <>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="glass-card rounded-2xl p-6">
            {hasVideo ? (
              <div className="group relative overflow-hidden rounded-2xl bg-slate-900">
                <video
                  controls
                  autoPlay
                  className="h-full w-full"
                  src={playUrl}
                  style={{ maxHeight: "480px" }}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full border border-white/40 bg-white/20 p-5 backdrop-blur">
                    <span className="block h-0 w-0 border-y-[12px] border-y-transparent border-l-[20px] border-l-white" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-8 py-16 text-center">
                <p className="text-base font-semibold tracking-tight text-slate-700">
                  No video file available
                </p>
                <p className="text-sm text-slate-400">
                  This recording was saved as metadata only. The video file was not uploaded.
                </p>
              </div>
            )}
          </section>

          <section className="glass-card rounded-2xl p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
              Recording Details
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-800">
              {recording.title}
            </h2>
            <div className="mt-6 space-y-4 text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-sm">
                <span className="text-slate-400">Teacher</span>
                <p className="mt-0.5 font-medium text-slate-700">{recording.teacher}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-sm">
                <span className="text-slate-400">Class</span>
                <p className="mt-0.5 font-medium text-slate-700">{recording.class_id}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-sm">
                <span className="text-slate-400">Recorded</span>
                <p className="mt-0.5 font-medium text-slate-700">
                  {new Date(recording.created_at).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-sm">
                <span className="text-slate-400">Available until</span>
                <p className="mt-0.5 font-medium text-slate-700">
                  {new Date(recording.expires_at).toLocaleDateString()}
                </p>
              </div>
              {recording.cloud_url ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-sky-700">Stored in cloud</span>
                </div>
              ) : null}
            </div>

            {hasVideo ? (
              <button
                type="button"
                onClick={() => void copyShareLink()}
                className={`premium-button mt-6 w-full rounded-xl py-3 text-sm font-semibold ${
                  copied
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "btn-primary text-white"
                }`}
              >
                {copied ? "Link copied!" : "Copy Share Link"}
              </button>
            ) : null}
          </section>
        </div>

        {/* ── Recording Intelligence Panel ─────────────────────────── */}
        {allowedRole !== "student" ? (
          <section className="mt-6 glass-card rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-600">
                  Recording Intelligence
                </p>
                <p className="mt-1 text-xs text-slate-400">AI-generated summary and highlights</p>
              </div>
              <div className="flex items-center gap-3">
                {intelligence ? (
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    intelligence.processing_status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : intelligence.processing_status === "processing" || intelligence.processing_status === "pending"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-rose-100 text-rose-700"
                  }`}>
                    {intelligence.processing_status === "completed"
                      ? intelligence.source_type === "ai" ? "AI Summary" : "Summary ready"
                      : intelligence.processing_status === "processing"
                        ? "Processing…"
                        : intelligence.processing_status === "pending"
                          ? "Pending"
                          : "Failed"}
                  </span>
                ) : null}
                {allowedRole === "teacher" ? (
                  <button
                    type="button"
                    onClick={() => void handleRegenerate()}
                    disabled={isRegenerating || intelligence?.processing_status === "processing"}
                    className="premium-button btn-secondary rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {isRegenerating ? "Regenerating…" : "Regenerate"}
                  </button>
                ) : null}
              </div>
            </div>

            {isLoadingIntelligence && !intelligence ? (
              <div className="mt-5 space-y-3">
                <div className="h-4 w-3/4 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-4 w-1/2 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : intelligence?.processing_status === "completed" && intelligence.summary ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
                    Summary
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{intelligence.summary}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Key Highlights
                  </p>
                  <ul className="mt-2 space-y-2">
                    {intelligence.highlights.map((highlight, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : intelligence?.processing_status === "pending" || intelligence?.processing_status === "processing" ? (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-700">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Generating summary — this may take a moment after the recording uploads.
              </div>
            ) : intelligence?.processing_status === "failed" ? (
              <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                Summary generation failed. Click Regenerate to try again.
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No summary available yet. Upload a recording to generate AI insights.
              </div>
            )}
          </section>
        ) : null}
        </>
      )}
    </DashboardShell>
  );
}
