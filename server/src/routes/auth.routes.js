import express from "express";
import { login, logout } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", requireAuth, logout);

export default router;
