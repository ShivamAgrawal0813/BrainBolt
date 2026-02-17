export class ApiError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: any;

  constructor(statusCode: number, message: string, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const BadRequest = (message = 'Bad Request', details?: any) => new ApiError(400, message, 'bad_request', details);
export const NotFound = (message = 'Not Found') => new ApiError(404, message, 'not_found');
export const Conflict = (message = 'Conflict', details?: any) => new ApiError(409, message, 'conflict', details);
export const TooManyRequests = (message = 'Too Many Requests') => new ApiError(429, message, 'rate_limited');
export const InternalError = (message = 'Internal Server Error') => new ApiError(500, message, 'internal_error');
