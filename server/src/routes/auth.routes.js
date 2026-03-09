import express from "express";
import {
  login,
  logout,
  changePassword,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", requireAuth, logout);
router.post("/change-password", requireAuth, changePassword);

export default router;
