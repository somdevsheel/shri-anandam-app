import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { Reconciliation } from "@/lib/types";

interface ReconciliationParams {
  branchId?: string;
  dateFrom: string;
  dateTo: string;
}

export function useReconciliation(params: ReconciliationParams | null) {
  return useQuery({
    queryKey: queryKeys.reconciliation((params ?? {}) as Record<string, unknown>),
    queryFn: () => apiRequest<Reconciliation>("/reports/payments/reconciliation", { query: params as unknown as Record<string, string> }),
    enabled: !!params,
  });
}
