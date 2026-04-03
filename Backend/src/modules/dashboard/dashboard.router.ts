import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { Role } from "@prisma/client";

const dashboardRouter = Router();

dashboardRouter.use(
  authenticate,
  requireRole(Role.VIEWER, Role.ANALYST, Role.ADMIN),
);

dashboardRouter.get("/summary", DashboardController.getSummary);

export { dashboardRouter };
