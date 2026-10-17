import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`,
  });
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
    return;
  }

  // Handle multer errors
  if (err.name === "MulterError") {
    const statusCode = err.message.includes("File too large") ? 413 : 400;
    res.status(statusCode).json({
      error: "Upload Error",
      message: err.message,
    });
    return;
  }

  // Handle Zod validation errors
  if (err.name === "ZodError") {
    res.status(400).json({
      error: "Validation Error",
      message: "Invalid input data",
    });
    return;
  }

  // body-parser-style errors carry their own 4xx status — a malformed JSON
  // body is a client mistake, not a server crash.
  const carried = err as { statusCode?: unknown; status?: unknown };
  const carriedStatus = [carried.statusCode, carried.status].find(
    (s): s is number => typeof s === "number" && s >= 400 && s < 500,
  );
  if (carriedStatus !== undefined) {
    res.status(carriedStatus).json({
      error: "Invalid request",
      message: err.name === "SyntaxError" ? "Malformed JSON body." : err.message,
    });
    return;
  }

  // Log unexpected errors server-side with full detail
  logger.error({ err }, "Unexpected error");

  // Never leak SQL/schema/params to clients in any environment
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong. Please try again later.",
    requestId: (res.getHeader("x-request-id") as string) || undefined,
  });
}
