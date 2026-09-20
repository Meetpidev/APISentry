// backend/src/routes/index.js
import { Router } from "express";
import providerRoutes from "./providerRoutes.js";
import changeRoutes from "./changeRoutes.js";
import prRoutes from "./prRoutes.js";
import scanRoutes from "./scanRoutes.js";
import githubRoutes from "./githubRoutes.js";
import repoRoutes from "./repoRoutes.js";
import complianceRoutes from "./complianceRoutes.js";
import compliancePatternRoutes from "./compliancePatternRoutes.js";
import autoComplianceRoutes from "./autoComplianceRoutes.js";

const router = Router();
router.use("/providers", providerRoutes);
router.use("/changes", changeRoutes);
router.use("/prs", prRoutes);
router.use("/scan", scanRoutes);
router.use("/github", githubRoutes);
router.use("/repos", repoRoutes);
router.use("/compliance", complianceRoutes);
router.use("/compliance-auto", autoComplianceRoutes);
router.use("/compliance-patterns", compliancePatternRoutes);
export default router;