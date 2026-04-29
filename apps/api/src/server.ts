import { createApp } from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { allModels, syncAllModelIndexes } from "./models";

async function startServer(): Promise<void> {
  const isDbConnected = await connectDatabase();
  if (isDbConnected) {
    // Ensure model registration even when routes haven't touched every collection yet.
    void allModels.length;
    if (env.syncIndexesOnBoot) {
      await syncAllModelIndexes();
      console.log("MongoDB indexes synced");
    }
  }
  const app = createApp();

  app.listen(env.port, () => {
    console.log(`SpendSense API listening on http://localhost:${env.port}`);
  });
}

void startServer();
