import { Router } from "express";
import { AiController } from "./ai.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { insightSchema, querySchema } from "./ai.schema";
import { Role } from "@prisma/client";
import { aiSearchSchema, listRecordsSchema } from "../records/records.schema";

const aiRouter = Router();

aiRouter.use(authenticate, requireRole(Role.ANALYST, Role.ADMIN));

aiRouter.get(
  "/insights",
  validate(insightSchema, "query"),
  AiController.getInsights,
);
aiRouter.get("/anomalies", AiController.detectAnomalies);
aiRouter.post("/query", validate(querySchema), AiController.query);
aiRouter.get(
  "/search",
  validate(listRecordsSchema, "query"),
  AiController.normalSearch,
);
aiRouter.get(
  "/ai-search",
  validate(aiSearchSchema, "query"),
  AiController.aiSearch,
);

export { aiRouter };
