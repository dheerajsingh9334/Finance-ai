import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";

export class DashboardController {
  static getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await DashboardService.getSummary(req.user!);
      const isFromCache = result.fromCache ? "HIT" : "MISS";
      
      res.setHeader("X-Cache", isFromCache);
      
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
