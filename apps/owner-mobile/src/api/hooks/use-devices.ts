import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RegisterDeviceDto } from "@shri-anandam/validation";
import { apiRequest } from "../client";
import { queryKeys } from "../query-client";
import type { DeviceToken } from "../types";

export function useDevices() {
  return useQuery({
    queryKey: queryKeys.devices,
    queryFn: () => apiRequest<DeviceToken[]>("/devices"),
  });
}

export function useRegisterDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RegisterDeviceDto) => apiRequest<DeviceToken>("/devices", { method: "POST", body: dto }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.devices });
    },
  });
}

export function useDeactivateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => apiRequest<{ message: string }>(`/devices/${deviceId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.devices });
    },
  });
}
