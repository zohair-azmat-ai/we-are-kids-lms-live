export type UserRole = "admin" | "teacher" | "student";

export type DemoUser = {
  email: string;
  password: string;
  role: UserRole;
  name: string;
};

export type SessionUser = {
  email: string;
  role: UserRole;
  name: string;
};

export const SESSION_STORAGE_KEY = "we-are-kids-session";

export const demoUsers: DemoUser[] = [
  {
    email: "admin@wearekids.com",
    password: "123456",
    role: "admin",
    name: "Admin Team",
  },
  {
    email: "teacher1@wearekids.com",
    password: "123456",
    role: "teacher",
    name: "Teacher One",
  },
  {
    email: "teacher2@wearekids.com",
    password: "123456",
    role: "teacher",
    name: "Teacher Two",
  },
  {
    email: "student1@wearekids.com",
    password: "123456",
    role: "student",
    name: "Student One",
  },
  {
    email: "student2@wearekids.com",
    password: "123456",
    role: "student",
    name: "Student Two",
  },
  {
    email: "student3@wearekids.com",
    password: "123456",
    role: "student",
    name: "Student Three",
  },
  {
    email: "student4@wearekids.com",
    password: "123456",
    role: "student",
    name: "Student Four",
  },
];

export function authenticateDemoUser(
  email: string,
  password: string,
  role: UserRole,
): SessionUser | null {
  const normalizedEmail = email.trim().toLowerCase();

  const user = demoUsers.find(
    (item) =>
      item.email === normalizedEmail &&
      item.password === password &&
      item.role === role,
  );

  if (!user) {
    return null;
  }

  return {
    email: user.email,
    role: user.role,
    name: user.name,
  };
}

export function saveSession(user: SessionUser): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
}

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as SessionUser;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
