import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../client";
import { queryKeys } from "../query-client";
import type { AppNotification, PaginatedResult } from "../types";

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications({}),
    queryFn: () => apiRequest<PaginatedResult<AppNotification>>("/notifications", { query: { pageSize: 50 } }),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<AppNotification>(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: (updated) => {
      queryClient.setQueriesData<PaginatedResult<AppNotification>>({ queryKey: ["notifications"] }, (data) => {
        if (!data) return data;
        return { ...data, items: data.items.map((n) => (n.id === updated.id ? updated : n)) };
      });
    },
  });
}
