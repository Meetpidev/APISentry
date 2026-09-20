// backend/src/routes/compliancePatternRoutes.js (new)
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireFields } from "../middlewares/validate.js";
import {
  listPatterns, createPattern, suggestPatternForChange, deletePattern,
} from "../controllers/compliancePatternController.js";

const router = Router();
router.get("/providers/:providerId", asyncHandler(listPatterns));
router.post("/providers/:providerId", requireFields(["pattern", "title", "description"]), asyncHandler(createPattern));
router.post("/suggest/:changeId", asyncHandler(suggestPatternForChange));
router.delete("/:patternId", asyncHandler(deletePattern));
export default router;