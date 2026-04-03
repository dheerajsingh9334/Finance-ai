import { Router } from "express";
import { RecordsController } from "./records.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createRecordSchema,
  updateRecordSchema,
  listRecordsSchema,
  aiSearchSchema,
} from "./records.schema";
import { Role } from "@prisma/client";

const recordsRouter = Router();

recordsRouter.get(
  "/",
  authenticate,
  validate(listRecordsSchema, "query"),
  RecordsController.listRecords,
);
recordsRouter.post(
  "/",
  authenticate,
  requireRole(Role.ANALYST, Role.ADMIN),
  validate(createRecordSchema),
  RecordsController.createRecord,
);
recordsRouter.get(
  "/deleted",
  authenticate,
  requireRole(Role.ADMIN),
  validate(listRecordsSchema, "query"),
  RecordsController.listDeletedRecords,
);
recordsRouter.get(
  "/search",
  authenticate,
  validate(aiSearchSchema, "query"),
  RecordsController.aiSearch,
);
recordsRouter.get("/:id", authenticate, RecordsController.getRecordById);
recordsRouter.patch(
  "/:id",
  authenticate,
  requireRole(Role.ANALYST, Role.ADMIN),
  validate(updateRecordSchema),
  RecordsController.updateRecord,
);
recordsRouter.delete(
  "/:id",
  authenticate,
  requireRole(Role.ADMIN),
  RecordsController.deleteRecord,
);
recordsRouter.patch(
  "/:id/restore",
  authenticate,
  requireRole(Role.ADMIN),
  RecordsController.restoreRecord,
);

export { recordsRouter };
