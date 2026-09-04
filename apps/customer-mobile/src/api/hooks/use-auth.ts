import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RequestOtpDto, VerifyOtpDto } from "@shri-anandam/validation";
import { apiRequest } from "../client";
import { useAuthStore } from "@/lib/auth-store";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: (dto: RequestOtpDto) => apiRequest<{ message: string }>("/auth/customer/otp/request", {
      method: "POST",
      body: dto,
      skipAuth: true,
    }),
  });
}

export function useVerifyOtp() {
  const setTokens = useAuthStore((s) => s.setTokens);

  return useMutation({
    mutationFn: (dto: VerifyOtpDto) =>
      apiRequest<TokenPair>("/auth/customer/otp/verify", { method: "POST", body: dto, skipAuth: true }),
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
      if (refreshToken) {
        // Best-effort — logging out client-side must succeed even if the
        // network call fails (e.g. already offline), so the token isn't
        // stranded on the device.
        await apiRequest("/auth/logout", { method: "POST", body: { refreshToken }, skipAuth: true }).catch(() => undefined);
      }
    },
    onSettled: async () => {
      await clear();
      queryClient.clear();
    },
  });
}
