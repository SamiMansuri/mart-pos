import express from "express";
import productsRouter from "./products.routes.js";
import billsRouter from "./bills.routes.js";
import usersRouter from "./users.routes.js";
import authRouter from "./auth.routes.js";
import reportsRouter from "./reports.routes.js";
import stockRouter from "./stock.routes.js";
import customersRouter from "./customer.routes.js";
import luckyDrawRouter from "./luckydraw.routes.js";
import supplierRoutes from "./suppliers.routes.js";
import purchaseRoutes from "./purchases.routes.js";

const router = express.Router();

router.use("/products", productsRouter);
router.use("/bills", billsRouter);
router.use("/users", usersRouter);
router.use("/auth", authRouter);
router.use("/reports", reportsRouter);
router.use("/stock", stockRouter);
router.use("/customers", customersRouter);
router.use("/lucky-draw", luckyDrawRouter);
router.use("/suppliers", supplierRoutes);
router.use("/purchases", purchaseRoutes);

export default router;
