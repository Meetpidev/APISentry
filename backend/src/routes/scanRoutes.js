// backend/src/routes/scanRoutes.js
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireFields } from "../middlewares/validate.js";
import { triggerScan } from "../controllers/scanController.js";

const router = Router();
router.post("/", requireFields(["providerId"]), asyncHandler(triggerScan)); // rawChangelogText optional
export default router;