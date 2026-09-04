import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { ErrorCode, type ApiErrorResponse } from "@shri-anandam/shared-types";
import { AppError } from "../errors/app.error";
import { Sentry } from "../../sentry";

/**
 * Global exception filter. Converts every thrown error into the standard
 * ApiErrorResponse envelope (section 42) and NEVER leaks a stack trace or
 * internal error message to the client in production.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? "unknown";
    const isProduction = process.env.NODE_ENV === "production";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = "An unexpected error occurred";
    let details: ApiErrorResponse["error"]["details"] = [];

    if (exception instanceof AppError) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === "string" ? body : ((body as { message?: string }).message ?? exception.message);
      code = mapStatusToErrorCode(status);
    } else {
      // Unknown/unexpected error — log full detail server-side, never
      // expose it. This is the ONLY branch that reaches Sentry
      // (security-architecture.md: "Sentry captures unhandled
      // exceptions") — an AppError/HttpException is an application
      // decision (a 404, a validation failure, a permission denial),
      // not a bug to page someone about; only a genuinely unexpected
      // throw is.
      this.logger.error(
        `Unhandled exception [${requestId}]: ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
      Sentry.withScope((scope) => {
        scope.setTag("requestId", requestId);
        scope.setContext("request", { method: request.method, url: request.url });
        Sentry.captureException(exception);
      });
    }

    if (status >= 500 && !(exception instanceof AppError)) {
      message = isProduction ? "An unexpected error occurred" : message;
    }

    const body: ApiErrorResponse = {
      success: false,
      error: { code, message, details },
      requestId,
    };

    response.status(status).json(body);
  }
}

/**
 * Best-effort mapping for plain NestJS HttpExceptions (thrown by Passport
 * guards, ValidationPipe, etc.) that don't carry one of our AppError
 * subclasses' explicit codes.
 */
function mapStatusToErrorCode(status: number): string {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ErrorCode.CONFLICT;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ErrorCode.RATE_LIMITED;
    case HttpStatus.BAD_REQUEST:
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return ErrorCode.VALIDATION_ERROR;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}
