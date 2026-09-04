import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode, type ApiErrorDetail } from "@shri-anandam/shared-types";

/**
 * Base application error. Domain code should throw this (or a subclass)
 * instead of raw NestJS HttpExceptions so every error carries a stable,
 * machine-readable `code` the clients can branch on — see section 42.
 */
export class AppError extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message, status);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(ErrorCode.NOT_FOUND, `${entity} not found${id ? ` (${id})` : ""}`, HttpStatus.NOT_FOUND);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: ApiErrorDetail[] = []) {
    super(ErrorCode.VALIDATION_ERROR, message, HttpStatus.BAD_REQUEST, details);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(message: string) {
    super(ErrorCode.INVALID_STATE_TRANSITION, message, HttpStatus.CONFLICT);
  }
}

export class InsufficientStockError extends AppError {
  constructor(message = "Insufficient stock available") {
    super(ErrorCode.INSUFFICIENT_STOCK, message, HttpStatus.CONFLICT);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(ErrorCode.SERVICE_UNAVAILABLE, message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
