import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { CategoryRuleModel } from "../models/category-rule.model";
import { UserModel } from "../models/user.model";
import { syncAllModelIndexes } from "../models";

const baseCategoryRules = [
  { keyword: "ZOMATO", categoryName: "Food", priority: 300 },
  { keyword: "SWIGGY", categoryName: "Food", priority: 300 },
  { keyword: "UBER", categoryName: "Travel", priority: 250 },
  { keyword: "OLA", categoryName: "Travel", priority: 250 },
  { keyword: "AMAZON", categoryName: "Shopping", priority: 200 },
  { keyword: "FLIPKART", categoryName: "Shopping", priority: 200 },
  { keyword: "IRCTC", categoryName: "Travel", priority: 220 }
];

function normalizeKeyword(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

async function run(): Promise<void> {
  const connected = await connectDatabase();
  if (!connected) {
    throw new Error("Cannot seed default user because MongoDB is not connected");
  }

  await syncAllModelIndexes();

  const email = process.env.SEED_USER_EMAIL ?? "owner@spendsense.local";
  const name = process.env.SEED_USER_NAME ?? "SpendSense Owner";
  const timezone = process.env.APP_TIMEZONE ?? "Asia/Kolkata";
  const currency = process.env.DEFAULT_CURRENCY ?? "INR";

  const user = await UserModel.findOneAndUpdate(
    { email },
    { email, name, timezone, currency },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (!user) {
    throw new Error("Failed to create/find default user");
  }

  const userId = user._id.toString();

  for (const rule of baseCategoryRules) {
    const keywordNormalized = normalizeKeyword(rule.keyword);
    await CategoryRuleModel.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        keywordNormalized,
        categoryName: rule.categoryName
      },
      {
        userId: new mongoose.Types.ObjectId(userId),
        keyword: rule.keyword,
        keywordNormalized,
        categoryName: rule.categoryName,
        priority: rule.priority,
        isActive: true
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log("Default user seeded successfully");
  console.log(`DEFAULT_USER_ID=${userId}`);
  console.log(`SEED_USER_EMAIL=${email}`);
  console.log("Add DEFAULT_USER_ID to apps/api/.env and apps/web/.env.local");
}

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
