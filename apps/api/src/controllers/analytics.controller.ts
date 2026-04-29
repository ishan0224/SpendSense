import type { Request, Response } from "express";
import { analyticsMonthQuerySchema } from "@spendsense/shared";
import type { RequestWithUser } from "../middlewares/resolve-user";
import {
  getCategoryAnalytics,
  getDailyAnalytics,
  getImpactAnalytics,
  getMerchantAnalytics,
  getSummaryAnalytics
} from "../services/analytics.service";

export async function summaryController(req: Request, res: Response): Promise<void> {
  const query = analyticsMonthQuerySchema.parse(req.query);
  const result = await getSummaryAnalytics((req as RequestWithUser).userId, query.month);
  res.status(200).json(result);
}

export async function categoriesController(req: Request, res: Response): Promise<void> {
  const query = analyticsMonthQuerySchema.parse(req.query);
  const result = await getCategoryAnalytics((req as RequestWithUser).userId, query.month);
  res.status(200).json(result);
}

export async function dailyController(req: Request, res: Response): Promise<void> {
  const query = analyticsMonthQuerySchema.parse(req.query);
  const result = await getDailyAnalytics((req as RequestWithUser).userId, query.month);
  res.status(200).json(result);
}

export async function merchantsController(req: Request, res: Response): Promise<void> {
  const query = analyticsMonthQuerySchema.parse(req.query);
  const result = await getMerchantAnalytics((req as RequestWithUser).userId, query.month);
  res.status(200).json(result);
}

export async function impactController(req: Request, res: Response): Promise<void> {
  const query = analyticsMonthQuerySchema.parse(req.query);
  const result = await getImpactAnalytics((req as RequestWithUser).userId, query.month);
  res.status(200).json(result);
}
