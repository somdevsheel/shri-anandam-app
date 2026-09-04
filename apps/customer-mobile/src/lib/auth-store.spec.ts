import { useAuthStore } from "./auth-store";

// expo-secure-store's native module isn't available under plain Jest
// (no device/simulator) — mock it as an in-memory map so auth-store's
// actual read/write/clear logic (not SecureStore itself) is what's
// under test here.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ isHydrated: false, isAuthenticated: false, accessToken: null, refreshToken: null });
  });

  it("starts unhydrated and unauthenticated", () => {
    const state = useAuthStore.getState();
    expect(state.isHydrated).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  it("hydrate() with nothing in storage settles to hydrated + unauthenticated", async () => {
    await useAuthStore.getState().hydrate();
    const state = useAuthStore.getState();
    expect(state.isHydrated).toBe(true);
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
  });

  it("setTokens() persists and marks the store authenticated", async () => {
    await useAuthStore.getState().setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe("access-1");
    expect(state.refreshToken).toBe("refresh-1");
  });

  it("a fresh hydrate() after setTokens() picks up the persisted tokens", async () => {
    await useAuthStore.getState().setTokens({ accessToken: "access-2", refreshToken: "refresh-2" });

    // Simulate an app restart: reset in-memory state, then hydrate from
    // (mocked) SecureStore the way app/_layout.tsx does on cold start.
    useAuthStore.setState({ isHydrated: false, isAuthenticated: false, accessToken: null, refreshToken: null });
    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.accessToken).toBe("access-2");
  });

  it("clear() removes tokens from storage and resets the store", async () => {
    await useAuthStore.getState().setTokens({ accessToken: "access-3", refreshToken: "refresh-3" });
    await useAuthStore.getState().clear();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();

    // And a subsequent hydrate() confirms storage was actually cleared,
    // not just the in-memory mirror.
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
