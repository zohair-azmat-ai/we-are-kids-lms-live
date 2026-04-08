"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { LoadingPanel } from "@/components/ui-state";
import { usePageTitle } from "@/hooks/use-page-title";
import { fetchRecording, getAssetUrl, type RecordingItem } from "@/lib/api";

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

  usePageTitle(recording ? recording.title : title);

  useEffect(() => {
    async function loadRecording() {
      try {
        setIsLoading(true);
        const recordingItem = await fetchRecording(params.recordingId);

        if (allowedRole === "teacher") {
          if (!user || user.role !== "teacher") {
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

  async function copyShareLink() {
    if (!recording) return;
    const url = resolvePlayUrl(recording);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
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
        <section className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-soft">
          <p className="text-red-600">
            {error || "This recording has expired and is no longer available."}
          </p>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
            {hasVideo ? (
              <div className="overflow-hidden rounded-[2rem] bg-slate-900">
                <video
                  controls
                  autoPlay
                  className="h-full w-full"
                  src={playUrl}
                  style={{ maxHeight: "480px" }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[2rem] bg-slate-100 px-8 py-16 text-center">
                <p className="text-base font-semibold text-slate-600">
                  No video file available
                </p>
                <p className="text-sm text-slate-400">
                  This recording was saved as metadata only. The video file was not uploaded.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
              Recording Details
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-800">
              {recording.title}
            </h2>
            <div className="mt-6 space-y-4 text-slate-700">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm">
                <span className="text-slate-400">Teacher</span>
                <p className="mt-0.5 font-medium text-slate-700">{recording.teacher}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm">
                <span className="text-slate-400">Class</span>
                <p className="mt-0.5 font-medium text-slate-700">{recording.class_id}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm">
                <span className="text-slate-400">Recorded</span>
                <p className="mt-0.5 font-medium text-slate-700">
                  {new Date(recording.created_at).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm">
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
                className={`mt-6 w-full rounded-full py-3 text-sm font-semibold transition active:scale-95 ${
                  copied
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-blue-600 text-white shadow-sm shadow-blue-100 hover:bg-blue-700"
                }`}
              >
                {copied ? "Link copied!" : "Copy Share Link"}
              </button>
            ) : null}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
