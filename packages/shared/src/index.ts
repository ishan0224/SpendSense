export const APP_NAME = "SpendSense";

export type HealthStatus = {
  status: "ok";
  service: "web" | "api";
  timestamp: string;
};

export * from "./constants/domain";
export * from "./constants/transactions";
export * from "./schemas/pagination";
export * from "./schemas/analytics";
export * from "./schemas/transactions";
export * from "./schemas/webhook";
export * from "./schemas/imports";
export * from "./schemas/settings";
export * from "./types/domain";
export * from "./types/transactions";
