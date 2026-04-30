import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../middlewares/async-handler";
import { resolveUser } from "../middlewares/resolve-user";
import {
  commitStatementImportController,
  listStatementImportsController,
  previewStatementImportController
} from "../controllers/statement-import.controller";
import { HttpError } from "../utils/http-error";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const lower = file.originalname.toLowerCase();
    if (lower.endsWith(".csv") || lower.endsWith(".xlsx")) {
      callback(null, true);
      return;
    }
    callback(new HttpError(400, "UNSUPPORTED_FILE_TYPE", "Only CSV and XLSX files are supported"));
  }
});

export const statementImportRouter = Router();

statementImportRouter.use(resolveUser);
statementImportRouter.post(
  "/statements/preview",
  upload.single("file"),
  asyncHandler(previewStatementImportController)
);
statementImportRouter.post("/statements/commit", asyncHandler(commitStatementImportController));
statementImportRouter.get("/statements", asyncHandler(listStatementImportsController));
