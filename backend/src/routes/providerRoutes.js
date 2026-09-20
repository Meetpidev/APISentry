import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireFields } from "../middlewares/validate.js";
import {
  listProviders, createProvider, addWatchedRepo, deleteProvider, deleteWatchedRepo,
} from "../controllers/providerController.js";

const router = Router();
router.get("/", asyncHandler(listProviders));
router.post("/", requireFields(["name"]), asyncHandler(createProvider));
router.post("/:id/repos", requireFields(["repoUrl"]), asyncHandler(addWatchedRepo));
router.delete("/:id", asyncHandler(deleteProvider));
router.delete("/:id/repos/:repoId", asyncHandler(deleteWatchedRepo));
export default router;