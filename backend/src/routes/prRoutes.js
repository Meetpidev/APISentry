// backend/src/routes/prRoutes.js
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { listPRs } from "../controllers/prController.js";

const router = Router();
router.get("/", asyncHandler(listPRs));
export default router;