import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireFields } from "../middlewares/validate.js";
import { runAutoScan, commitApprovedFindings } from "../controllers/autoComplianceController.js";

const router = Router();
router.post("/scan", requireFields(["providerId", "repoId"]), asyncHandler(runAutoScan));
router.post("/commit", requireFields(["repoId", "approvedFiles"]), asyncHandler(commitApprovedFindings));
export default router;