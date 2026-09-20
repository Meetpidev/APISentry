// backend/src/routes/repoRoutes.js
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getRepoBranches } from "../controllers/repoController.js";

const router = Router();
router.get("/:repoId/branches", asyncHandler(getRepoBranches));
export default router;