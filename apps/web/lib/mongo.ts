import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var __spendsenseMongoConnection: Promise<typeof mongoose> | undefined;
}

export async function connectMongoForRouteHandler(): Promise<typeof mongoose> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required for route-handler database access");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!global.__spendsenseMongoConnection) {
    global.__spendsenseMongoConnection = mongoose.connect(mongoUri);
  }

  return global.__spendsenseMongoConnection;
}
