import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { analyticsRouter } from "./routes/analytics.routes";
import { settingsRouter } from "./routes/settings.routes";
import { statementImportRouter } from "./routes/statement-import.routes";
import { transactionRouter } from "./routes/transaction.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientUrl
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString()
    });
  });

  app.use("/v1/analytics", analyticsRouter);
  app.use("/v1/transactions", transactionRouter);
  app.use("/v1/imports", statementImportRouter);
  app.use("/v1", settingsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
