import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { env } from "../../config/env";
import { RegisterInput, LoginInput, UpdateProfileInput } from "./auth.schema";
import { Role } from "@prisma/client";

export const generateAccessToken = (userId: string, role: Role) => {
  return jwt.sign({ userId, role }, env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
};

export const generateRefreshToken = (userId: string, role: Role) => {
  return jwt.sign({ userId, role }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};

export class AuthService {
  static async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError("Email already exists", 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const requestedRole = data.role ?? Role.VIEWER;

    if (requestedRole !== Role.VIEWER) {
      if (!env.ROLE_SECRET) {
        throw new AppError("Privileged registration is disabled", 403);
      }

      if (data.roleSecret !== env.ROLE_SECRET) {
        throw new AppError("Invalid role passcode", 403);
      }
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        phone: data.phone,
        role: requestedRole,
      },
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id, user.role);

    const { password, ...userWithoutPassword } = user;
    return { accessToken, refreshToken, user: userWithoutPassword };
  }

  static async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    if (!user.isActive) {
      throw new AppError("Account is deactivated", 403);
    }

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) {
      throw new AppError("Invalid credentials", 401);
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id, user.role);

    const { password, ...userWithoutPassword } = user;
    return { accessToken, refreshToken, user: userWithoutPassword };
  }

  static async refreshAccess(token: string) {
    try {
      const payload: any = jwt.verify(token, env.REFRESH_TOKEN_SECRET);

      const user = await prisma.user.findFirst({
        where: {
          id: payload.userId,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true, role: true },
      });

      if (!user) {
        throw new AppError("User is inactive or no longer exists", 403);
      }

      const newAccessToken = generateAccessToken(user.id, user.role);
      return { newAccessToken };
    } catch (e) {
      throw new AppError("Invalid or expired refresh token", 401);
    }
  }

  static async getProfile(userId: string) {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!profile) {
      throw new AppError("User not found", 404);
    }
    return profile;
  }

  static async updateProfile(userId: string, data: UpdateProfileInput) {
    if (!data.name && !data.phone && !data.avatarUrl) {
      throw new AppError("Nothing to update", 400);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatarUrl: true,
      },
    });

    return updated;
  }
}
