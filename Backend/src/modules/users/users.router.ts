import { Router } from "express";
import { UsersController } from "./users.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { listUsersSchema, updateRoleSchema, updateStatusSchema } from "./users.schema";
import { Role } from "@prisma/client";

const usersRouter = Router();

usersRouter.use(authenticate, requireRole(Role.ADMIN));

usersRouter.get("/", validate(listUsersSchema, "query"), UsersController.listUsers);
usersRouter.get("/:id", UsersController.getUserById);
usersRouter.patch("/:id/role", validate(updateRoleSchema), UsersController.updateRole);
usersRouter.patch("/:id/status", validate(updateStatusSchema), UsersController.updateStatus);
usersRouter.delete("/:id", UsersController.deleteUser);

export { usersRouter };
