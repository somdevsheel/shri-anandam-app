import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { StaffLoginDto } from "@shri-anandam/validation";
import { apiRequest } from "../client";
import { useAuthStore } from "@/lib/auth-store";
import { deactivateCurrentDevice } from "@/lib/push-notifications";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function useStaffLogin() {
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: (dto: StaffLoginDto) =>
      apiRequest<TokenPair>("/auth/staff/login", { method: "POST", body: dto, skipAuth: true }),
    onSuccess: async (data) => {
      await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    },
  });
}

export function useLogout() {
  const { refreshToken, clear } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Best-effort, in this order: deactivate this device's push token
      // first (while the access token used to authorize it is still
      // valid) so a stale token isn't left registered against a
      // now-logged-out session, then invalidate the refresh token
      // itself. Neither call blocks logging out client-side if the
      // network is down — a stranded token is a lesser problem than a
      // stuck logout button.
      await deactivateCurrentDevice().catch(() => undefined);
      if (refreshToken) {
        await apiRequest("/auth/logout", { method: "POST", body: { refreshToken }, skipAuth: true }).catch(() => undefined);
      }
    },
    onSettled: async () => {
      await clear();
      queryClient.clear();
    },
  });
}
