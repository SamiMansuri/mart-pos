import { getFailureResponse } from "../utils/response.util.js";
import createHttpError from "http-errors";

export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const status = error.errorType || "error";
  const message = error.message || "Something went wrong";

  res.status(statusCode).json(
    getFailureResponse({
      status,
      statusCode,
      message,
    }),
  );
};

export const notFoundHandler = (req, res, next) => {
  console.log("Route not found", req.url);
  next(createHttpError(404, "Route not found"));
};
