import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { env } from "../config/env";
import { HttpError } from "../utils/http-error";

export type RequestWithUser = Request & {
  userId: string;
};

export function resolveUser(req: Request, _res: Response, next: NextFunction): void {
  const headerValue = req.header("x-user-id");
  const userId = headerValue?.trim() || process.env.DEFAULT_USER_ID || env.defaultUserId;

  if (!userId) {
    throw new HttpError(401, "USER_ID_MISSING", "Unable to resolve user identity");
  }

  if (!isValidObjectId(userId)) {
    throw new HttpError(400, "INVALID_USER_ID", "Resolved user ID is not a valid ObjectId");
  }

  (req as RequestWithUser).userId = userId;
  next();
}
