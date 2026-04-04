"use client";

import { RecordingPlayback } from "@/components/recording-playback";

export default function AdminRecordingPlaybackPage() {
  return (
    <RecordingPlayback
      allowedRole="admin"
      title="Admin Recording Playback"
      subtitle="Review saved recordings across the nursery system."
    />
  );
}
