import prisma from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { ListUsersInput, UpdateRoleInput, UpdateStatusInput } from "./users.schema";

export class UsersService {
  static async listUsers(filters: ListUsersInput) {
    const { page, limit, role, isActive } = filters;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  static async getUserById(id: string) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }
    return user;
  }

  static async updateRole(id: string, data: UpdateRoleInput) {
    const updated = await prisma.user.update({
      where: { id },
      data: { role: data.role },
      select: { id: true, role: true, email: true },
    });
    return updated;
  }

  static async updateStatus(id: string, data: UpdateStatusInput) {
    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: data.isActive },
      select: { id: true, isActive: true, email: true },
    });
    return updated;
  }

  static async deleteUser(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new AppError("Cannot delete yourself", 400);
    }

    try {
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      return { success: true };
    } catch (e: any) {
      if (e.code === "P2025") {
        throw new AppError("User not found", 404);
      }
      throw e;
    }
  }
}
