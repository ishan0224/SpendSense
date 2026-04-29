import mongoose from "mongoose";
import { env } from "./env";

let hasConnectAttempted = false;

export async function connectDatabase(): Promise<boolean> {
  if (!env.mongoUri) {
    console.warn("MONGODB_URI is not configured. API will use in-memory transaction store.");
    return false;
  }

  const currentState = mongoose.connection.readyState;
  if (currentState === 1) {
    return true;
  }

  if (hasConnectAttempted && currentState !== 0) {
    return false;
  }

  hasConnectAttempted = true;
  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("MongoDB connected");
    return true;
  } catch (error) {
    console.error("MongoDB connection failed. Falling back to in-memory store.", error);
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  await mongoose.disconnect();
}
