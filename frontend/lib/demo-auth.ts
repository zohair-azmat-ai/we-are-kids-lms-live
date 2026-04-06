export type UserRole = "admin" | "teacher" | "student";

export type SessionUser = {
  user_id: string;
  email: string;
  role: UserRole;
  name: string;
  status: "active" | "inactive";
};

export type StoredSession = {
  access_token: string;
  expires_at: string;
  user: SessionUser;
};

export const SESSION_STORAGE_KEY = "we-are-kids-session";

export function saveSession(session: StoredSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredSession;
  } catch {
    return null;
  }
}

export function getSession(): SessionUser | null {
  const storedSession = getStoredSession();

  if (!storedSession) {
    return null;
  }

  return storedSession.user;
}

export function getAccessToken(): string {
  return getStoredSession()?.access_token ?? "";
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
