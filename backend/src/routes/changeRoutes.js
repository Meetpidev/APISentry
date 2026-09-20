// backend/src/routes/changeRoutes.js
import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { listChanges, getChange, generatePR, deleteChange, ignoreChange, deleteAllChanges } from "../controllers/changeController.js";

const router = Router();
router.get("/", asyncHandler(listChanges));
router.delete("/", asyncHandler(deleteAllChanges));
router.get("/:id", asyncHandler(getChange));
router.post("/:id/generate-pr", asyncHandler(generatePR));
router.post("/:id/ignore", asyncHandler(ignoreChange));
router.delete("/:id", asyncHandler(deleteChange));
export default router;