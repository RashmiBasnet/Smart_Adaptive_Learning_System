import { Router } from "express";
import {
  overview,
  strengths,
  recommendation,
  masteryHistory,
} from "../controllers/dashboard.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/overview", requireAuth, overview);
router.get("/concepts/strengths", requireAuth, strengths);
router.get("/recommendation", requireAuth, recommendation);
router.get("/mastery-history/:conceptId", requireAuth, masteryHistory);

export default router;
