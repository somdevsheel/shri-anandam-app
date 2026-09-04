import { create } from "zustand";
import { clearTokens, loadTokens, saveTokens, type StoredTokens } from "./secure-storage";
import { decodeStaffToken } from "./jwt";

interface StaffIdentity {
  id: string;
  email: string;
  permissions: string[];
}

interface AuthState {
  /** Whether SecureStore has been checked yet — same pattern as apps/customer-mobile. */
  isHydrated: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  staff: StaffIdentity | null;
  hydrate: () => Promise<void>;
  setTokens: (tokens: StoredTokens) => Promise<void>;
  clear: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

function staffFromToken(accessToken: string): StaffIdentity | null {
  const payload = decodeStaffToken(accessToken);
  if (!payload) return null;
  return { id: payload.sub, email: payload.email, permissions: payload.permissions };
}

/**
 * The only global client state this app keeps for auth — tokens plus the
 * staff identity decoded from them (see lib/jwt.ts) — everything else
 * (orders, notifications, devices) is server state in TanStack Query's
 * cache, same rule as apps/customer-mobile's auth-store.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  isHydrated: false,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  staff: null,

  hydrate: async () => {
    const tokens = await loadTokens();
    set({
      isHydrated: true,
      isAuthenticated: tokens !== null,
      accessToken: tokens?.accessToken ?? null,
      refreshToken: tokens?.refreshToken ?? null,
      staff: tokens ? staffFromToken(tokens.accessToken) : null,
    });
  },

  setTokens: async (tokens) => {
    await saveTokens(tokens);
    set({
      isAuthenticated: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      staff: staffFromToken(tokens.accessToken),
    });
  },

  clear: async () => {
    await clearTokens();
    set({ isAuthenticated: false, accessToken: null, refreshToken: null, staff: null });
  },

  hasPermission: (permission) => get().staff?.permissions.includes(permission) ?? false,
}));
