import { Request, Response, NextFunction } from "express";
import { UsersService } from "./users.service";
import { ListUsersInput } from "./users.schema";

export class UsersController {
  static listUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await UsersService.listUsers(
        req.query as unknown as ListUsersInput,
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  static getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = await UsersService.getUserById(req.params.id as string);
      return res.status(200).json({ success: true, user });
    } catch (error) {
      next(error);
    }
  };

  static updateRole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = await UsersService.updateRole(
        req.params.id as string,
        req.body,
      );
      return res.status(200).json({ success: true, user });
    } catch (error) {
      next(error);
    }
  };

  static updateStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = await UsersService.updateStatus(
        req.params.id as string,
        req.body,
      );
      return res.status(200).json({ success: true, user });
    } catch (error) {
      next(error);
    }
  };

  static deleteUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await UsersService.deleteUser(req.params.id as string, req.user!.userId);
      return res.status(200).json({ success: true, message: "User deleted" });
    } catch (error) {
      next(error);
    }
  };
}
