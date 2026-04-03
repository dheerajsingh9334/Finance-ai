import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
} from "./auth.schema";

const authRouter = Router();

authRouter.post("/register", validate(registerSchema), AuthController.register);
authRouter.post("/login", validate(loginSchema), AuthController.login);

authRouter.post("/refreshToken", AuthController.refreshToken);
authRouter.post("/logout", AuthController.logout);

authRouter.get("/me", authenticate, AuthController.getProfile);
authRouter.patch(
  "/updateProfile",
  authenticate,
  validate(updateProfileSchema),
  AuthController.updateProfile,
);

export { authRouter };
