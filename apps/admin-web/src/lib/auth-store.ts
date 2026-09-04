import { create } from "zustand";
import type { ApiResponse } from "@shri-anandam/shared-types";
import { decodeStaffToken } from "./jwt";

interface StaffIdentity {
  id: string;
  email: string;
  permissions: string[];
}

interface AuthState {
  /** Whether the initial silent-refresh attempt (against the httpOnly cookie) has resolved yet — the app shell blocks on this before deciding login-page vs dashboard, same pattern as the mobile apps' isHydrated. */
  isHydrated: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  staff: StaffIdentity | null;
  hydrate: () => Promise<void>;
  setAccessToken: (token: string) => void;
  clear: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

function staffFromToken(accessToken: string): StaffIdentity | null {
  const payload = decodeStaffToken(accessToken);
  if (!payload) return null;
  return { id: payload.sub, email: payload.email, permissions: payload.permissions };
}

/**
 * ADR-020: the access token lives ONLY here, in memory — never
 * localStorage/sessionStorage (XSS-exfiltratable) and never a
 * JS-readable cookie. A hard page reload loses it and re-runs hydrate()
 * against the httpOnly refresh cookie instead; the brief gap while that
 * resolves is the accepted trade-off for keeping the long-lived
 * credential out of reach of any injected script.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  isHydrated: false,
  isAuthenticated: false,
  accessToken: null,
  staff: null,

  hydrate: async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ accessToken: string }>;
      if (!res.ok || !json.success) {
        set({ isHydrated: true, isAuthenticated: false, accessToken: null, staff: null });
        return;
      }
      set({
        isHydrated: true,
        isAuthenticated: true,
        accessToken: json.data.accessToken,
        staff: staffFromToken(json.data.accessToken),
      });
    } catch {
      set({ isHydrated: true, isAuthenticated: false, accessToken: null, staff: null });
    }
  },

  setAccessToken: (token) => {
    set({ isAuthenticated: true, accessToken: token, staff: staffFromToken(token) });
  },

  clear: async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    set({ isAuthenticated: false, accessToken: null, staff: null });
  },

  hasPermission: (permission) => get().staff?.permissions.includes(permission) ?? false,
}));
