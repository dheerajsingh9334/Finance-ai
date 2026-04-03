import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { AppError } from "../lib/errors";

const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 1,
  ANALYST: 2,
  ADMIN: 3,
};

export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }

    const minRequiredLevel = Math.min(...roles.map((r) => ROLE_HIERARCHY[r]));
    const userLevel = ROLE_HIERARCHY[req.user.role];

    if (userLevel < minRequiredLevel) {
      return next(new AppError("Forbidden: Insufficient role permissions", 403));
    }

    next();
  };
};
