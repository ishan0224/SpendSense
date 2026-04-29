import { Router } from "express";
import { asyncHandler } from "../middlewares/async-handler";
import { resolveUser } from "../middlewares/resolve-user";
import {
  createTransactionController,
  deleteTransactionController,
  ignoreTransactionController,
  listTransactionsController,
  restoreTransactionController,
  updateTransactionController
} from "../controllers/transaction.controller";

export const transactionRouter = Router();

transactionRouter.use(resolveUser);
transactionRouter.get("/", asyncHandler(listTransactionsController));
transactionRouter.post("/", asyncHandler(createTransactionController));
transactionRouter.patch("/:id", asyncHandler(updateTransactionController));
transactionRouter.delete("/:id", asyncHandler(deleteTransactionController));
transactionRouter.post("/:id/ignore", asyncHandler(ignoreTransactionController));
transactionRouter.post("/:id/restore", asyncHandler(restoreTransactionController));
