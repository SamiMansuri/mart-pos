import express from "express";
import {
  getReports,
  getCashierReport,
} from "../controllers/reports.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowAdmin } from "../middlewares/allowAdmin.js";

const router = express.Router();

router.get("/", requireAuth, allowAdmin, getReports);
router.get("/cashier", requireAuth, getCashierReport);

export default router;
