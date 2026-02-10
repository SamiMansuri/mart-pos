import express from "express";
import { addStock } from "../controllers/stock.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowAdmin } from "../middlewares/allowAdmin.js";

const router = express.Router();

// All stock routes are admin-only
router.use(requireAuth, allowAdmin);

router.post("/add", addStock);

export default router;
