import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError, ZodIssue } from "zod";
import { AppError } from "../lib/errors";

export const validate = (
  schema: ZodSchema,
  target: "body" | "query" = "body",
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsedData = schema.parse(req[target]);
      req[target] = parsedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors
          .map((issue: ZodIssue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", ");
        return next(new AppError(`Validation Error: ${errorMessages}`, 422));
      }
      next(error);
    }
  };
};
