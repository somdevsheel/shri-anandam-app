import * as SecureStore from "expo-secure-store";

/**
 * Keychain (iOS) / Keystore-backed encrypted storage (Android) — same
 * rule as apps/customer-mobile/src/lib/secure-storage.ts (section 70/71):
 * tokens never touch AsyncStorage in plaintext.
 */
const ACCESS_TOKEN_KEY = "shri_anandam_owner.access_token";
const REFRESH_TOKEN_KEY = "shri_anandam_owner.refresh_token";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
