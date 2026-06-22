export class AppError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static notFound(message = "Resource not found", code?: string): AppError {
    return new AppError(message, 404, code);
  }

  static unauthorized(message = "Unauthorized", code?: string): AppError {
    return new AppError(message, 401, code);
  }

  static forbidden(message = "Forbidden", code?: string): AppError {
    return new AppError(message, 403, code);
  }

  static badRequest(message = "Bad request", code?: string): AppError {
    return new AppError(message, 400, code);
  }

  static conflict(message = "Conflict", code?: string): AppError {
    return new AppError(message, 409, code);
  }
}
