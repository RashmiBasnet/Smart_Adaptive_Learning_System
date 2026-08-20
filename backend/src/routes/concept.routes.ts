import { Router } from "express";
import { materials } from "../controllers/concept.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/:conceptId/materials", requireAuth, materials);

export default router;
