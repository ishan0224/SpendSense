import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { isHttpError } from "../utils/http-error";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found"
    }
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.flatten()
      }
    });
    return;
  }

  if (isHttpError(error)) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  if (error instanceof MulterError) {
    const isSizeLimit = error.code === "LIMIT_FILE_SIZE";
    res.status(isSizeLimit ? 413 : 400).json({
      error: {
        code: isSizeLimit ? "STATEMENT_FILE_TOO_LARGE" : "MULTIPART_ERROR",
        message: isSizeLimit
          ? "Statement file exceeds 5MB limit"
          : "Unable to process multipart upload"
      }
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error"
    }
  });
}
