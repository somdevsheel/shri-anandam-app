import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../client";
import { queryKeys } from "../query-client";
import type { Notification, PaginatedResult } from "../types";

interface ListNotificationsParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

export function useNotifications(params: ListNotificationsParams = {}) {
  return useQuery({
    queryKey: queryKeys.notifications(params as Record<string, unknown>),
    queryFn: () =>
      apiRequest<PaginatedResult<Notification>>("/notifications", {
        query: { status: params.status, page: params.page ?? 1, pageSize: params.pageSize ?? 20 },
      }),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => apiRequest<Notification>(`/notifications/${notificationId}/read`, { method: "PATCH" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
