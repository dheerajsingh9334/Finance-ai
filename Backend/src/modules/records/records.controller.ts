import { Request, Response, NextFunction } from "express";
import { RecordsService } from "./records.service";
import { cache } from "../../lib/redis";
import { AiSearchInput, ListRecordsInput } from "./records.schema";
export class RecordsController {
  static listRecords = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await RecordsService.listRecords(
        req.query as unknown as ListRecordsInput,
        req.user!,
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  static createRecord = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const idempotencyKey = req.header("idempotency-key");
      let cacheKey: string | null = null;

      if (idempotencyKey) {
        cacheKey = `idempotency:${req.user!.userId}:${idempotencyKey}`;
        const cachedResult = await cache.get(cacheKey);
        if (cachedResult) {
          return res
            .status(200)
            .json({ success: true, record: cachedResult, cached: true });
        }
      }

      const result = await RecordsService.createRecord(
        req.body,
        req.user!.userId,
      );

      if (cacheKey) {
        await cache.set(cacheKey, result, 1800); // Cache for 30 minutes
      }

      return res.status(201).json({ success: true, record: result });
    } catch (error) {
      next(error);
    }
  };

  static updateRecord = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await RecordsService.updateRecord(
        req.params.id as string,
        req.body,
        req.user!,
      );
      return res.status(200).json({ success: true, record: result });
    } catch (error) {
      next(error);
    }
  };

  static deleteRecord = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await RecordsService.softDeleteRecord(
        req.params.id as string,
        req.user!,
      );
      return res.status(200).json({
        success: true,
        message: "Record deleted",
        recordId: result.id,
      });
    } catch (error) {
      next(error);
    }
  };

  static restoreRecord = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await RecordsService.restoreRecord(
        req.params.id as string,
        req.user!,
      );
      return res
        .status(200)
        .json({ success: true, message: "Record restored", record: result });
    } catch (error) {
      next(error);
    }
  };

  static getRecordById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await RecordsService.getRecordById(
        req.params.id as string,
        req.user!,
      );
      return res.status(200).json({ success: true, record: result });
    } catch (error) {
      next(error);
    }
  };

  static listDeletedRecords = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await RecordsService.listDeletedRecords(
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
      const { query, page, limit } = req.query as unknown as AiSearchInput;
      const result = await RecordsService.aiSearchRecords(
        query,
        req.user!,
        page,
        limit,
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };
}
