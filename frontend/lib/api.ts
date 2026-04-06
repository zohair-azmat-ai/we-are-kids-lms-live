const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
  .trim()
  .replace(/\/$/, "");

const LIVEKIT_URL = (process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "")
  .trim()
  .replace(/\/$/, "");

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "")
  .trim()
  .replace(/\/$/, "");

export type HealthResponse = {
  status: string;
  service: string;
  version: string;
};

export type LiveClassSession = {
  class_id: string;
  teacher_name: string;
  teacher_email: string;
  title: string;
  status: "live" | "scheduled" | "ended";
  participants_count: number;
  started_at?: string | null;
};

export type LiveKitRole = "teacher" | "student";

export type LiveKitTokenResponse = {
  token: string;
  url: string;
  room_name: string;
  participant_name: string;
};

export type RecordingItem = {
  recording_id: string;
  class_id: string;
  title: string;
  teacher: string;
  created_at: string;
  file_path: string;
  file_url: string;
  expires_at: string;
};

export type RecordingUpdateResponse = {
  success: boolean;
  recording: RecordingItem;
};

export type RecordingDeleteResponse = {
  success: boolean;
  recording_id: string;
};

export type UserStatus = "active" | "inactive";
export type ClassStatus = "active" | "archived";
export type LiveStatus = "live" | "scheduled" | "ended";

export type AdminTeacher = {
  teacher_id: string;
  name: string;
  email: string;
  assigned_classes_count: number;
  status: UserStatus;
};

export type AdminTeacherInput = {
  name: string;
  email: string;
  password: string;
  status: UserStatus;
};

export type AdminStudent = {
  student_id: string;
  name: string;
  email: string;
  enrolled_classes_count: number;
  status: UserStatus;
};

export type AdminStudentInput = {
  name: string;
  email: string;
  password: string;
  status: UserStatus;
};

export type AdminClass = {
  class_id: string;
  title: string;
  teacher_id: string;
  teacher_name: string;
  student_ids: string[];
  enrolled_students_count: number;
  status: ClassStatus;
  live_status: LiveStatus;
};

export type AdminClassInput = {
  title: string;
  teacher_id: string;
  student_ids: string[];
  status: ClassStatus;
};

export type AdminLiveSession = {
  class_id: string;
  title: string;
  teacher_name: string;
  participants_count: number;
  start_time: string | null;
  status: LiveStatus;
};

export type SuccessResponse = {
  success: boolean;
  message: string;
};

export type BillingPlan = "starter" | "standard" | "premium";

export type BillingPlanFeatures = {
  teachers_limit: number;
  students_limit: number;
  classes_limit: number;
  monthly_label: string;
  audience: string;
  highlights: string[];
};

export type BillingPlanInfo = {
  code: BillingPlan;
  name: string;
  description: string;
  is_current: boolean;
  features: BillingPlanFeatures;
};

export type BillingSubscription = {
  school_name: string;
  billing_email: string;
  plan: BillingPlan;
  subscription_status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plans: BillingPlanInfo[];
  teachers_count: number;
  students_count: number;
  classes_count: number;
};

export type BillingCheckoutResponse = {
  checkout_url: string;
};

export type BillingCustomerPortalResponse = {
  portal_url: string;
};

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    throw new Error(errorPayload?.detail ?? fallbackMessage);
  }

  return (await response.json()) as T;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  fallbackMessage: string,
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      "The app is missing its API connection setting. Please set NEXT_PUBLIC_API_BASE_URL.",
    );
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, init);
    return await parseResponse<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof Error && error.message !== "Failed to fetch") {
      throw error;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("You appear to be offline. Please check your internet connection.");
    }

    throw new Error("Unable to reach the school platform right now. Please try again.");
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getAppUrl(): string {
  return APP_URL;
}

export function getResolvedLiveKitUrl(urlFromBackend?: string): string {
  return LIVEKIT_URL || (urlFromBackend ?? "").trim();
}

export function getAssetUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error(
      "The app is missing its API connection setting. Please set NEXT_PUBLIC_API_BASE_URL.",
    );
  }

  const baseUrl = new URL(API_BASE_URL);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  baseUrl.pathname = normalizedPath;
  baseUrl.search = "";
  baseUrl.hash = "";

  return baseUrl.toString();
}

export async function fetchHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>(
    "/health",
    { cache: "no-store" },
    "Health check failed.",
  );
}

export async function fetchLiveClasses(): Promise<LiveClassSession[]> {
  return requestJson<LiveClassSession[]>(
    "/api/v1/classes/live",
    { cache: "no-store" },
    "Live classes request failed.",
  );
}

export async function startLiveClass(
  teacherEmail: string,
): Promise<LiveClassSession> {
  return requestJson<LiveClassSession>(
    "/api/v1/classes/start",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teacher_email: teacherEmail,
      }),
    },
    "Start class request failed.",
  );
}

export async function endLiveClass(
  classId: string,
  teacherEmail: string,
): Promise<SuccessResponse> {
  return requestJson<SuccessResponse>(
    `/api/v1/classes/${classId}/end`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        teacher_email: teacherEmail,
      }),
    },
    "End class request failed.",
  );
}

export async function joinClassPresence(params: {
  classId: string;
  role: LiveKitRole;
  participantEmail: string;
  participantName: string;
}): Promise<LiveClassSession> {
  return requestJson<LiveClassSession>(
    `/api/v1/classes/${params.classId}/presence/join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: params.role,
        participant_email: params.participantEmail,
        participant_name: params.participantName,
      }),
    },
    "Unable to register classroom join.",
  );
}

export async function leaveClassPresence(params: {
  classId: string;
  role: LiveKitRole;
  participantEmail: string;
  participantName: string;
}): Promise<LiveClassSession> {
  return requestJson<LiveClassSession>(
    `/api/v1/classes/${params.classId}/presence/leave`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: params.role,
        participant_email: params.participantEmail,
        participant_name: params.participantName,
      }),
    },
    "Unable to register classroom leave.",
  );
}

export async function fetchClassSession(
  classId: string,
): Promise<LiveClassSession> {
  return requestJson<LiveClassSession>(
    `/api/v1/classes/${classId}`,
    { cache: "no-store" },
    "Class session request failed.",
  );
}

export async function requestLiveKitToken(params: {
  roomName: string;
  participantName: string;
  participantEmail: string;
  role: LiveKitRole;
}): Promise<LiveKitTokenResponse> {
  return requestJson<LiveKitTokenResponse>(
    "/api/v1/livekit/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room_name: params.roomName,
        participant_name: params.participantName,
        participant_email: params.participantEmail,
        role: params.role,
      }),
    },
    "Unable to prepare your live classroom connection.",
  );
}

export async function uploadRecording(params: {
  classId: string;
  teacherName: string;
  title: string;
  file: File;
}): Promise<RecordingItem> {
  const formData = new FormData();
  formData.append("class_id", params.classId);
  formData.append("teacher_name", params.teacherName);
  formData.append("title", params.title);
  formData.append("recorded_file", params.file);

  return requestJson<RecordingItem>(
    "/api/v1/recordings/upload",
    {
      method: "POST",
      body: formData,
    },
    "Recording upload failed.",
  );
}

export async function fetchRecordings(): Promise<RecordingItem[]> {
  return requestJson<RecordingItem[]>(
    "/api/v1/recordings",
    { cache: "no-store" },
    "Recordings request failed.",
  );
}

export async function fetchRecording(
  recordingId: string,
): Promise<RecordingItem> {
  return requestJson<RecordingItem>(
    `/api/v1/recordings/${recordingId}`,
    { cache: "no-store" },
    "Recording request failed.",
  );
}

export async function updateRecordingTitle(
  recordingId: string,
  title: string,
): Promise<RecordingUpdateResponse> {
  return requestJson<RecordingUpdateResponse>(
    `/api/v1/recordings/${recordingId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    },
    "Recording update failed.",
  );
}

export async function deleteRecording(
  recordingId: string,
): Promise<RecordingDeleteResponse> {
  return requestJson<RecordingDeleteResponse>(
    `/api/v1/recordings/${recordingId}`,
    { method: "DELETE" },
    "Recording delete failed.",
  );
}

export async function fetchAdminTeachers(): Promise<AdminTeacher[]> {
  return requestJson<AdminTeacher[]>(
    "/api/v1/admin/teachers",
    { cache: "no-store" },
    "Teachers request failed.",
  );
}

export async function createAdminTeacher(
  payload: AdminTeacherInput,
): Promise<AdminTeacher> {
  return requestJson<AdminTeacher>(
    "/api/v1/admin/teachers",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Teacher create failed.",
  );
}

export async function updateAdminTeacher(
  teacherId: string,
  payload: AdminTeacherInput,
): Promise<AdminTeacher> {
  return requestJson<AdminTeacher>(
    `/api/v1/admin/teachers/${teacherId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Teacher update failed.",
  );
}

export async function deleteAdminTeacher(
  teacherId: string,
): Promise<SuccessResponse> {
  return requestJson<SuccessResponse>(
    `/api/v1/admin/teachers/${teacherId}`,
    { method: "DELETE" },
    "Teacher delete failed.",
  );
}

export async function fetchAdminStudents(): Promise<AdminStudent[]> {
  return requestJson<AdminStudent[]>(
    "/api/v1/admin/students",
    { cache: "no-store" },
    "Students request failed.",
  );
}

export async function createAdminStudent(
  payload: AdminStudentInput,
): Promise<AdminStudent> {
  return requestJson<AdminStudent>(
    "/api/v1/admin/students",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Student create failed.",
  );
}

export async function updateAdminStudent(
  studentId: string,
  payload: AdminStudentInput,
): Promise<AdminStudent> {
  return requestJson<AdminStudent>(
    `/api/v1/admin/students/${studentId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Student update failed.",
  );
}

export async function deleteAdminStudent(
  studentId: string,
): Promise<SuccessResponse> {
  return requestJson<SuccessResponse>(
    `/api/v1/admin/students/${studentId}`,
    { method: "DELETE" },
    "Student delete failed.",
  );
}

export async function fetchAdminClasses(): Promise<AdminClass[]> {
  return requestJson<AdminClass[]>(
    "/api/v1/admin/classes",
    { cache: "no-store" },
    "Classes request failed.",
  );
}

export async function createAdminClass(
  payload: AdminClassInput,
): Promise<AdminClass> {
  return requestJson<AdminClass>(
    "/api/v1/admin/classes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Class create failed.",
  );
}

export async function updateAdminClass(
  classId: string,
  payload: AdminClassInput,
): Promise<AdminClass> {
  return requestJson<AdminClass>(
    `/api/v1/admin/classes/${classId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Class update failed.",
  );
}

export async function deleteAdminClass(
  classId: string,
): Promise<SuccessResponse> {
  return requestJson<SuccessResponse>(
    `/api/v1/admin/classes/${classId}`,
    { method: "DELETE" },
    "Class delete failed.",
  );
}

export async function fetchAdminLiveSessions(): Promise<AdminLiveSession[]> {
  return requestJson<AdminLiveSession[]>(
    "/api/v1/admin/live-sessions",
    { cache: "no-store" },
    "Live sessions request failed.",
  );
}

export async function endAdminLiveSession(
  classId: string,
): Promise<SuccessResponse> {
  return requestJson<SuccessResponse>(
    `/api/v1/admin/live-sessions/${classId}/end`,
    {
      method: "POST",
    },
    "End live session failed.",
  );
}

export async function fetchBillingSubscription(
  adminEmail: string,
): Promise<BillingSubscription> {
  const query = new URLSearchParams({ admin_email: adminEmail }).toString();
  return requestJson<BillingSubscription>(
    `/api/v1/billing/subscription?${query}`,
    { cache: "no-store" },
    "Billing subscription request failed.",
  );
}

export async function createBillingCheckoutSession(params: {
  adminEmail: string;
  plan: BillingPlan;
  appUrl?: string;
}): Promise<BillingCheckoutResponse> {
  const resolvedAppUrl = (params.appUrl ?? APP_URL).trim();

  if (!resolvedAppUrl) {
    throw new Error(
      "The app is missing NEXT_PUBLIC_APP_URL, which is required for Stripe checkout redirects.",
    );
  }

  return requestJson<BillingCheckoutResponse>(
    "/api/v1/billing/checkout-session",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        admin_email: params.adminEmail,
        plan: params.plan,
        app_url: resolvedAppUrl,
      }),
    },
    "Unable to create Stripe checkout session.",
  );
}

export async function createBillingCustomerPortal(params: {
  adminEmail: string;
  appUrl?: string;
}): Promise<BillingCustomerPortalResponse> {
  const resolvedAppUrl = (params.appUrl ?? APP_URL).trim();

  if (!resolvedAppUrl) {
    throw new Error(
      "The app is missing NEXT_PUBLIC_APP_URL, which is required for Stripe portal redirects.",
    );
  }

  return requestJson<BillingCustomerPortalResponse>(
    "/api/v1/billing/customer-portal",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        admin_email: params.adminEmail,
        app_url: resolvedAppUrl,
      }),
    },
    "Unable to open Stripe customer portal.",
  );
}
