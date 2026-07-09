import { Router } from "express";
import { serve, submit } from "../controllers/quiz.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/:conceptId", requireAuth, serve);
router.post("/:conceptId/submit", requireAuth, submit);

export default router;
