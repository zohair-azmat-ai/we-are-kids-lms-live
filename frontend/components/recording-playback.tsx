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
            <div className="overflow-hidden rounded-[2rem] bg-slate-900">
              <video
                controls
                className="h-full w-full"
                src={getAssetUrl(recording.file_url)}
              />
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">
              Recording Details
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-800">
              {recording.title}
            </h2>
            <div className="mt-6 space-y-4 text-slate-700">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                Teacher: {recording.teacher}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                Class ID: {recording.class_id}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                Created: {new Date(recording.created_at).toLocaleString()}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                Available until: {new Date(recording.expires_at).toLocaleDateString()}
              </div>
            </div>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
