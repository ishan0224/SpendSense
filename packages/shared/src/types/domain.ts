import type {
  ingestionLogStatuses,
  paymentModes,
  reconciliationStatuses,
  transactionDirections,
  transactionSources
} from "../constants/domain";

export type TransactionDirection = (typeof transactionDirections)[number];
export type TransactionSource = (typeof transactionSources)[number];
export type ReconciliationStatus = (typeof reconciliationStatuses)[number];
export type PaymentMode = (typeof paymentModes)[number];
export type IngestionLogStatus = (typeof ingestionLogStatuses)[number];
