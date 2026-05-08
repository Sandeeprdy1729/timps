export const ErrorCodes = {
  UNKNOWN: 'UNKNOWN',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  ENCODING_ERROR: 'ENCODING_ERROR',
  CERTIFICATE_ERROR: 'CERTIFICATE_ERROR',
  SSL_ERROR: 'SSL_ERROR',
  HANDshake_ERROR: 'HANDSHAKE_ERROR',
  ABORTED: 'ABORTED',
  REQUEST_SIZE_EXCEEDED: 'REQUEST_SIZE_EXCEEDED',
  RESPONSE_SIZE_EXCEEDED: 'RESPONSE_SIZE_EXCEEDED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface TIMPSErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  cause?: Error;
  context?: Record<string, unknown>;
  retryable?: boolean;
}

export class TIMPSError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly cause: Error | undefined;
  readonly context: Record<string, unknown>;
  readonly retryable: boolean;

  constructor(options: TIMPSErrorOptions) {
    const { code, message, statusCode, cause, context, retryable } = options;
    super(message);
    this.name = 'TIMPSError';
    this.code = code;
    this.statusCode = statusCode || getStatusCode(code);
    this.cause = cause;
    this.context = context || {};
    this.retryable = retryable ?? isRetryable(code);
    Error.captureStackTrace(this, TIMPSError);
  }
}

function getStatusCode(code: ErrorCode): number {
  const statusCodes: Record<ErrorCode, number> = {
    [ErrorCodes.NOT_FOUND]: 404,
    [ErrorCodes.UNAUTHORIZED]: 401,
    [ErrorCodes.FORBIDDEN]: 403,
    [ErrorCodes.BAD_REQUEST]: 400,
    [ErrorCodes.VALIDATION_ERROR]: 422,
    [ErrorCodes.CONFLICT]: 409,
    [ErrorCodes.RATE_LIMITED]: 429,
    [ErrorCodes.NETWORK_ERROR]: 0,
    [ErrorCodes.TIMEOUT]: 408,
    [ErrorCodes.SERVER_ERROR]: 500,
    [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
    [ErrorCodes.INTERNAL_ERROR]: 500,
    [ErrorCodes.PARSE_ERROR]: 400,
    [ErrorCodes.ENCODING_ERROR]: 400,
    [ErrorCodes.CERTIFICATE_ERROR]: 495,
    [ErrorCodes.SSL_ERROR]: 495,
    [ErrorCodes.HANDSHAKE_ERROR]: 495,
    [ErrorCodes.ABORTED]: 409,
    [ErrorCodes.REQUEST_SIZE_EXCEEDED]: 413,
    [ErrorCodes.RESPONSE_SIZE_EXCEEDED]: 513,
    [ErrorCodes.UNKNOWN]: 500,
  };
  return statusCodes[code] || 500;
}

function isRetryable(code: ErrorCode): boolean {
  const retryableCodes = [
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.TIMEOUT,
    ErrorCodes.SERVER_ERROR,
    ErrorCodes.SERVICE_UNAVAILABLE,
    ErrorCodes.RATE_LIMITED,
  ];
  return retryableCodes.includes(code);
}

export function isTIMPSError(error: unknown): error is TIMPSError {
  return error instanceof TIMPSError;
}

export function getErrorCode(error: unknown): ErrorCode {
  if (isTIMPSError(error)) {
    return error.code;
  }
  if (error instanceof Error) {
    return ErrorCodes.UNKNOWN;
  }
  return ErrorCodes.UNKNOWN;
}

export function isRetryableError(error: unknown): boolean {
  if (isTIMPSError(error)) {
    return error.retryable;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('timeout') || message.includes('network');
  }
  return false;
}

export function formatError(error: unknown): string {
  if (isTIMPSError(error)) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function createError(code: ErrorCode, message: string, context?: Record<string, unknown>): TIMPSError {
  return new TIMPSError({ code, message, context });
}

export const errors = {
  notFound(resource: string, id?: string): TIMPSError {
    return new TIMPSError({
      code: ErrorCodes.NOT_FOUND,
      message: `${resource}${id ? ` '${id}'` : ''} not found`,
    });
  },

  unauthorized(message = 'Unauthorized'): TIMPSError {
    return new TIMPSError({
      code: ErrorCodes.UNAUTHORIZED,
      message,
      statusCode: 401,
    });
  },

  forbidden(message = 'Forbidden'): TIMPSError {
    return new TIMPSError({
      code: ErrorCodes.FORBIDDEN,
      message,
      statusCode: 403,
    });
  },

  badRequest(message: string): TIMPSError {
    return new TIMPSError({
      code: ErrorCodes.BAD_REQUEST,
      message,
      statusCode: 400,
    });
  },

  validation(message: string, context?: Record<string, unknown>): TIMPSError {
    return new TIMPSError({
      code: ErrorCodes.VALIDATION_ERROR,
      message,
      statusCode: 422,
      context,
    });
  },

  rateLimited(retryAfter?: number): TIMPSError {
    return new TIMPSError({
      code: ErrorCodes.RATE_LIMITED,
      message: 'Rate limit exceeded',
      statusCode: 429,
      retryable: true,
    });
  },

  timeout(message = 'Request timed out'): TIMPSError {
    return new TIMPSError({
      code: ErrorCodes.TIMEOUT,
      message,
      statusCode: 408,
      retryable: true,
    });
  },

  internal(message = 'Internal server error'): TIMPSError {
    return new TIMPSError({
      code: ErrorCodes.INTERNAL_ERROR,
      message,
      statusCode: 500,
    });
  },
};