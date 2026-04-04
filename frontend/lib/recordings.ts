import type { RecordingItem } from "@/lib/api";

export type RecordingStatus = "available" | "expires soon" | "expired";

export function getRecordingStatus(recording: RecordingItem): {
  label: RecordingStatus;
  className: string;
} {
  const now = Date.now();
  const expiresAt = new Date(recording.expires_at).getTime();

  if (expiresAt <= now) {
    return {
      label: "expired",
      className: "bg-red-100 text-red-700",
    };
  }

  const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;

  if (expiresAt - now <= twoDaysInMs) {
    return {
      label: "expires soon",
      className: "bg-amber-100 text-amber-800",
    };
  }

  return {
    label: "available",
    className: "bg-emerald-100 text-emerald-700",
  };
}
