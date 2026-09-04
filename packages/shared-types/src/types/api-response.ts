/**
 * Standard API envelope. Every endpoint in services/api responds with one
 * of these two shapes (see docs/architecture and section 42 of the
 * project brief). Stack traces are never included in production error
 * responses.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: ApiErrorDetail[];
  };
  requestId: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Machine-readable error codes used across the API. Extend as new domains are added. */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED",
  ORDER_NOT_AVAILABLE: "ORDER_NOT_AVAILABLE",
  PRODUCT_UNAVAILABLE: "PRODUCT_UNAVAILABLE",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  COUPON_INVALID: "COUPON_INVALID",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  /** A backing integration exists in code but isn't configured for this
   * environment (e.g. S3 credentials blank) — distinct from
   * INTERNAL_ERROR so a client can tell "we broke" from "an admin needs
   * to finish setting this up." */
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
