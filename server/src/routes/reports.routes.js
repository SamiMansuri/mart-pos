import express from "express";
import { getReports } from "../controllers/reports.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowAdmin } from "../middlewares/allowAdmin.js";

const router = express.Router();

router.use(requireAuth, allowAdmin);

router.get("/", getReports);

export default router;
