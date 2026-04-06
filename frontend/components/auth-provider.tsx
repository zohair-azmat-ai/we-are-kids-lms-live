"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchCurrentUser, type AuthLoginResponse } from "@/lib/api";
import {
  clearSession,
  getStoredSession,
  saveSession,
  type SessionUser,
  type UserRole,
} from "@/lib/demo-auth";

type AuthContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: AuthLoginResponse) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    const storedSession = getStoredSession();

    if (!storedSession?.access_token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await fetchCurrentUser();
      const nextUser: SessionUser = {
        user_id: currentUser.user_id,
        email: currentUser.email,
        role: currentUser.role as UserRole,
        name: currentUser.name,
        status: currentUser.status,
      };
      saveSession({
        access_token: storedSession.access_token,
        expires_at: storedSession.expires_at,
        user: nextUser,
      });
      setUser(nextUser);
    } catch {
      clearSession();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function login(payload: AuthLoginResponse) {
    const nextUser: SessionUser = {
      user_id: payload.user.user_id,
      email: payload.user.email,
      role: payload.user.role,
      name: payload.user.name,
      status: payload.user.status,
    };
    saveSession({
      access_token: payload.access_token,
      expires_at: payload.expires_at,
      user: nextUser,
    });
    setUser(nextUser);
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refresh,
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
