"use client";

import { RecordingPlayback } from "@/components/recording-playback";

export default function TeacherRecordingPlaybackPage() {
  return (
    <RecordingPlayback
      allowedRole="teacher"
      title="Teacher Recording Playback"
      subtitle="Review your class recordings before sharing them with students."
    />
  );
}
