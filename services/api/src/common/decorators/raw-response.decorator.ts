import { SetMetadata } from "@nestjs/common";

export const IS_RAW_RESPONSE_KEY = "isRawResponse";

/**
 * Opts a route out of ResponseInterceptor's ApiSuccessResponse envelope
 * — for the handful of responses that must be a specific wire format a
 * caller outside this codebase's control expects verbatim (Prometheus's
 * text exposition format for `GET /metrics`; a future webhook ack body
 * would be the same category), not this API's own JSON contract.
 */
export const RawResponse = () => SetMetadata(IS_RAW_RESPONSE_KEY, true);
