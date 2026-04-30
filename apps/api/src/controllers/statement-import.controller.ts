import type { Request, Response } from "express";
import { statementCommitRequestSchema, statementColumnMappingSchema } from "@spendsense/shared";
import { env } from "../config/env";
import type { RequestWithUser } from "../middlewares/resolve-user";
import { HttpError } from "../utils/http-error";
import {
  assertStatementImportsSupported,
  commitStatementImport,
  createMongoStatementImportPersistence,
  listStatementImports,
  previewStatementImport
} from "../services/statement-import.service";

function parseMapping(raw: unknown) {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "INVALID_MAPPING", "Mapping must be valid JSON");
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new HttpError(400, "INVALID_MAPPING", "Mapping must be an object");
  }
  const candidate = parsed as Record<string, unknown>;
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (typeof value === "string" && value.trim().length > 0) {
      normalized[key] = value.trim();
    }
  }
  const partialSchema = statementColumnMappingSchema.partial();
  return partialSchema.parse(normalized);
}

function parseFileType(fileName: string): "csv" | "xlsx" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return "csv";
  }
  if (lower.endsWith(".xlsx")) {
    return "xlsx";
  }
  throw new HttpError(400, "UNSUPPORTED_FILE_TYPE", "Only CSV and XLSX files are supported");
}

export async function previewStatementImportController(req: Request, res: Response): Promise<void> {
  assertStatementImportsSupported();

  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    throw new HttpError(400, "STATEMENT_FILE_REQUIRED", "Upload a CSV or XLSX file");
  }

  const mapping = parseMapping(req.body.mapping);
  const result = await previewStatementImport({
    fileName: file.originalname,
    fileType: parseFileType(file.originalname),
    fileBuffer: file.buffer,
    mapping,
    statementMonth: typeof req.body.statementMonth === "string" ? req.body.statementMonth : undefined,
    bankCode: typeof req.body.bankCode === "string" ? req.body.bankCode : undefined
  });

  res.status(200).json(result);
}

export async function commitStatementImportController(req: Request, res: Response): Promise<void> {
  assertStatementImportsSupported();

  const payload = statementCommitRequestSchema.parse(req.body);
  const result = await commitStatementImport({
    userId: (req as RequestWithUser).userId,
    payload,
    defaultCurrency: env.defaultCurrency.toUpperCase(),
    persistence: createMongoStatementImportPersistence()
  });

  res.status(200).json(result);
}

export async function listStatementImportsController(req: Request, res: Response): Promise<void> {
  assertStatementImportsSupported();

  const result = await listStatementImports(
    (req as RequestWithUser).userId,
    createMongoStatementImportPersistence()
  );
  res.status(200).json(result);
}
