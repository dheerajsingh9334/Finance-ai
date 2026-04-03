import { Request, Response, NextFunction } from "express";
import { AiService } from "./ai.service";
import { AiSearchInput, ListRecordsInput } from "../records/records.schema";

export class AiController {
  static getInsights = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const months = Number(req.query.months) || 3;
      const result = await AiService.getSpendingInsights(req.user!, months);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  static detectAnomalies = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await AiService.detectAnomalies(req.user!);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  static query = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await AiService.naturalLanguageQuery(
        req.body.question,
        req.user!,
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  static normalSearch = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await AiService.normalRecordSearch(
        req.query as unknown as ListRecordsInput,
        req.user!,
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  static aiSearch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await AiService.aiRecordSearch(
        req.query as unknown as AiSearchInput,
        req.user!,
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
