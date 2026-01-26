import express from "express";
import cors from "cors";
import indexRouter from "./routes/index.routes.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/errorHandler.middleware.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use("/api/v1", indexRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
