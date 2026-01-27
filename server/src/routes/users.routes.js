import express from "express";
import { createUser } from "../controllers/users.controller.js";
import { allowAdmin } from "../middlewares/allowAdmin.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = express.Router();

router.post("/", requireAuth, allowAdmin, createUser);

export default router;