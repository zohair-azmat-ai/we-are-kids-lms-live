"use client";

import { RecordingPlayback } from "@/components/recording-playback";

export default function StudentRecordingPage() {
  return (
    <RecordingPlayback
      allowedRole="student"
      title="Recording Playback"
      subtitle="Watch saved class recordings in a simple student-friendly player."
    />
  );
}
