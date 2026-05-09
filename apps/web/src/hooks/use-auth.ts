import { useGetUser, getGetUserQueryKey } from "@workspace/api-client-react";
import { useState, useEffect } from "react";

const STORAGE_KEY = "ghar_khoj_user_id";
const REAL_USER_KEY = "ghar_khoj_real_user_id";
const JWT_STORAGE_KEY = "ghar_khoj_jwt";

export function getStoredJwt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(JWT_STORAGE_KEY);
}

export function setStoredJwt(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) localStorage.removeItem(JWT_STORAGE_KEY);
  else localStorage.setItem(JWT_STORAGE_KEY, token);
}

export function getStoredUserId(): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? parseInt(stored, 10) : null;
}

export function setStoredUserId(id: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(id));
  window.location.reload();
}

export function logout() {
  if (typeof window === "undefined") return;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("ghar_khoj_welcome_shown_")) {
      localStorage.removeItem(key);
    }
  }
  localStorage.removeItem(REAL_USER_KEY);
  localStorage.removeItem(JWT_STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = "/";
}

export function isRealUserLoggedIn(): boolean {
  return !!getStoredJwt();
}

export function useAuth() {
  const [userId, setUserId] = useState<number | null>(getStoredUserId());

  useEffect(() => {
    setUserId(getStoredUserId());
  }, []);

  const isAuthenticated = isRealUserLoggedIn();
  const { data: user, isLoading, error } = useGetUser(userId ?? 0, {
    query: {
      queryKey: getGetUserQueryKey(userId ?? 0),
      retry: false,
      refetchOnWindowFocus: false,
      enabled: isAuthenticated && !!userId,
    }
  });

  return {
    userId,
    user,
    isLoading,
    isAuthenticated: isRealUserLoggedIn(),
    isVerified: user?.isVerified || false,
    isAdmin: user?.role === "admin",
    isOwner: user?.role === "owner",
    isTenant: user?.role === "tenant",
    isRealUser: isRealUserLoggedIn(),
  };
}
