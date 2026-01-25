import express from "express";
import cors from "cors";
import indexRouter from "./routes/index.routes.js";
// import {
//   errorHandler,
//   jwtHandler,
//   notFoundHandler,
//   validationHandler,
// } from "./middlewares/error.middleware.js";
// import cookieParser from "cookie-parser";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use("/api/v1", indexRouter);

// app.use(validationHandler);
// app.use(jwtHandler);
// app.use(notFoundHandler);
// app.use(errorHandler);

export default app;
