import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import { env } from "../../config/env";

const isProd = env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ("none" as const) : ("lax" as const),
};

export class AuthController {
  static register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accessToken, refreshToken, user } = await AuthService.register(req.body);

      res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
      res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

      return res.status(201).json({ msg: "Registered successfully", user });
    } catch (error) {
      next(error);
    }
  };

  static login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accessToken, refreshToken, user } = await AuthService.login(req.body);

      res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
      res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

      return res.status(200).json({ msg: "Login Successfully", user });
    } catch (error) {
      next(error);
    }
  };

  static refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ msg: "Refresh Token Missing" });
      }

      const { newAccessToken } = await AuthService.refreshAccess(refreshToken);

      res.cookie("accessToken", newAccessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });

      return res.status(200).json({ msg: "Access Token refreshed" });
    } catch (error) {
      next(error);
    }
  };

  static logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.clearCookie("accessToken", cookieOptions);
      res.clearCookie("refreshToken", cookieOptions);

      return res.status(200).json({ msg: "Logout Successfully" });
    } catch (error) {
      next(error);
    }
  };

  static getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await AuthService.getProfile(req.user!.userId);
      return res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  };

  static updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await AuthService.updateProfile(req.user!.userId, req.body);
      return res.status(200).json({ msg: "Profile updated", user });
    } catch (error) {
      next(error);
    }
  };
}
