import express from "express";
import { createUser, getAllUsers } from "../controllers/users.controller.js";
import { allowAdmin } from "../middlewares/allowAdmin.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = express.Router();

router.get("/", requireAuth, allowAdmin, getAllUsers);
router.post("/", requireAuth, allowAdmin, createUser);

export default router;