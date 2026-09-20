// backend/src/routes/githubRoutes.js
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireFields } from "../middlewares/validate.js";
import { connectGithub, githubStatus } from "../controllers/githubController.js";

const router = Router();
router.get("/status", asyncHandler(githubStatus));
router.post("/connect", requireFields(["token"]), asyncHandler(connectGithub));
export default router;