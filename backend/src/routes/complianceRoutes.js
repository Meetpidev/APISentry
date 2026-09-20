// backend/src/routes/complianceRoutes.js (unchanged from before)
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireFields } from "../middlewares/validate.js";
import { runComplianceScan } from "../controllers/complianceController.js";

const router = Router();
router.post("/", requireFields(["providerId", "repoId"]), asyncHandler(runComplianceScan));
export default router;