import express from "express";
import productsRouter from "./products.routes.js";
import billsRouter from "./bills.routes.js";

const router = express.Router();

router.use("/products", productsRouter);
router.use("/bills", billsRouter);

export default router;
