"use client";

import { useParams } from "next/navigation";

import { LiveClassroomRoom } from "@/components/live-classroom-room";

export default function StudentClassroomPage() {
  const params = useParams<{ classId: string }>();
  return <LiveClassroomRoom classId={params.classId} role="student" />;
}
