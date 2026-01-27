import express from "express";
import productsRouter from "./products.routes.js";
import billsRouter from "./bills.routes.js";
import usersRouter from "./users.routes.js";
import authRouter from "./auth.routes.js";

const router = express.Router();

router.use("/products", productsRouter);
router.use("/bills", billsRouter);
router.use("/users", usersRouter);
router.use("/auth", authRouter);

export default router;
