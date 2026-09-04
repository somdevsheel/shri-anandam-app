import { create } from "zustand";
import { clearTokens, loadTokens, saveTokens, type StoredTokens } from "./secure-storage";

interface AuthState {
  /** Whether SecureStore has been checked yet — the root layout blocks on this before deciding splash vs. home vs. login. */
  isHydrated: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  hydrate: () => Promise<void>;
  setTokens: (tokens: StoredTokens) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * The ONLY global client state this app keeps for auth — a thin,
 * synchronously-readable mirror of what's in secure storage, so the API
 * client (src/api/client.ts) can read the current access token on every
 * request without an async SecureStore round-trip. Everything else
 * (profile, cart, catalog) is server state and lives in TanStack Query's
 * cache instead (section 71: "Server state should not be duplicated
 * unnecessarily into global client state").
 */
export const useAuthStore = create<AuthState>((set) => ({
  isHydrated: false,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,

  hydrate: async () => {
    const tokens = await loadTokens();
    set({
      isHydrated: true,
      isAuthenticated: tokens !== null,
      accessToken: tokens?.accessToken ?? null,
      refreshToken: tokens?.refreshToken ?? null,
    });
  },

  setTokens: async (tokens) => {
    await saveTokens(tokens);
    set({ isAuthenticated: true, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  },

  clear: async () => {
    await clearTokens();
    set({ isAuthenticated: false, accessToken: null, refreshToken: null });
  },
}));
