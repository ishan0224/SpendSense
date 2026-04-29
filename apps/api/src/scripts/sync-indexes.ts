import { connectDatabase, disconnectDatabase } from "../config/database";
import { syncAllModelIndexes } from "../models";

async function run(): Promise<void> {
  const connected = await connectDatabase();
  if (!connected) {
    throw new Error("Cannot sync indexes because MongoDB is not connected");
  }
  await syncAllModelIndexes();
  console.log("All model indexes synced");
}

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
