import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { ApiSuccessResponse } from "@shri-anandam/shared-types";
import type { RequestWithId } from "../middleware/request-id.middleware";

/**
 * Wraps every successful controller return value in the standard
 * ApiSuccessResponse envelope (section 42). Errors are handled separately
 * by GlobalExceptionFilter so this only ever runs on the success path.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
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
