import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.code && { code: err.code }),
    });
  }

  const prismaErrorCode =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: string }).code
      : undefined;

  if (prismaErrorCode === "P2002") {
    return res
      .status(409)
      .json({ success: false, error: "Resource already exists" });
  }

  if (prismaErrorCode === "P2025") {
    return res
      .status(404)
      .json({ success: false, error: "Resource not found" });
  }

  console.error("Unhandled Exception:", err);

  return res.status(500).json({
    success: false,
    error: "Internal server error",
  });
};
