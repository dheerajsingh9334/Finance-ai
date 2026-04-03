import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../lib/errors";
import { env } from "../config/env";
import prisma from "../lib/prisma";

interface JwtPayload {
  userId: string;
  role?: string;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let token = req.cookies?.accessToken;

  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new AppError("Missing authorization token", 401));
  }

  try {
    const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as JwtPayload;
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, role: true, email: true },
    });

    if (!user) {
      return next(new AppError("Account is inactive or no longer exists", 401));
    }

    req.user = {
      userId: user.id,
      role: user.role,
      email: user.email,
    };
    next();
  } catch (error) {
    return next(new AppError("Invalid or expired token", 401));
  }
};
