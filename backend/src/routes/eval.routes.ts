import { Router } from "express";
import { questions, submit } from "../controllers/eval.controller";
import { requireAuth } from "../middleware/auth";

// Study-only held-out evaluation instrument. Auth-gated like everything else,
// but deliberately NOT prerequisite-gated: pre-tests run before mastery exists.
const router = Router();

router.get("/:conceptSlug/questions", requireAuth, questions);
router.post("/:conceptSlug/submit", requireAuth, submit);

export default router;
