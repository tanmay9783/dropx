export class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export function createError(code, message, statusCode = 400) {
  return new AppError(code, message, statusCode);
}
