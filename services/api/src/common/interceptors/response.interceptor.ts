import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { ApiSuccessResponse } from "@shri-anandam/shared-types";
import type { RequestWithId } from "../middleware/request-id.middleware";
import { IS_RAW_RESPONSE_KEY } from "../decorators/raw-response.decorator";

/**
 * Wraps every successful controller return value in the standard
 * ApiSuccessResponse envelope (section 42), except routes marked
 * `@RawResponse()` (caught live: `GET /metrics` returning Prometheus's
 * text exposition format inside a JSON string instead of as-is —
 * unscrapeable). Errors are handled separately by GlobalExceptionFilter
 * so this only ever runs on the success path.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T> | T> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(IS_RAW_RESPONSE_KEY, [context.getHandler(), context.getClass()]);
    if (isRaw) return next.handle();

    const request = context.switchToHttp().getRequest<RequestWithId>();
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        requestId: request.requestId,
      })),
    );
  }
}
