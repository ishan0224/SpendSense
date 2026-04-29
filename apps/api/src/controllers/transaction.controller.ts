import type { Request, Response } from "express";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema
} from "@spendsense/shared";
import type { RequestWithUser } from "../middlewares/resolve-user";
import { HttpError } from "../utils/http-error";
import {
  createTransaction,
  ignoreTransaction,
  listTransactions,
  restoreTransaction,
  softDeleteTransaction,
  updateTransaction
} from "../services/transaction.service";

export async function listTransactionsController(req: Request, res: Response): Promise<void> {
  const query = listTransactionsQuerySchema.parse(req.query);
  const result = await listTransactions((req as RequestWithUser).userId, query);
  res.status(200).json(result);
}

export async function createTransactionController(req: Request, res: Response): Promise<void> {
  const input = createTransactionSchema.parse(req.body);
  const created = await createTransaction((req as RequestWithUser).userId, input);
  res.status(201).json(created);
}

export async function updateTransactionController(req: Request, res: Response): Promise<void> {
  const input = updateTransactionSchema.parse(req.body);
  const transactionId = req.params.id;
  if (!transactionId) {
    throw new HttpError(400, "INVALID_TRANSACTION_ID", "Transaction ID is required");
  }
  const updated = await updateTransaction((req as RequestWithUser).userId, transactionId, input);
  res.status(200).json(updated);
}

export async function deleteTransactionController(req: Request, res: Response): Promise<void> {
  const transactionId = req.params.id;
  if (!transactionId) {
    throw new HttpError(400, "INVALID_TRANSACTION_ID", "Transaction ID is required");
  }
  const updated = await softDeleteTransaction((req as RequestWithUser).userId, transactionId);
  res.status(200).json(updated);
}

export async function ignoreTransactionController(req: Request, res: Response): Promise<void> {
  const transactionId = req.params.id;
  if (!transactionId) {
    throw new HttpError(400, "INVALID_TRANSACTION_ID", "Transaction ID is required");
  }
  const updated = await ignoreTransaction((req as RequestWithUser).userId, transactionId);
  res.status(200).json(updated);
}

export async function restoreTransactionController(req: Request, res: Response): Promise<void> {
  const transactionId = req.params.id;
  if (!transactionId) {
    throw new HttpError(400, "INVALID_TRANSACTION_ID", "Transaction ID is required");
  }
  const updated = await restoreTransaction((req as RequestWithUser).userId, transactionId);
  res.status(200).json(updated);
}
