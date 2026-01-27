import { asyncHandler } from "../utils/asynHandler.util.js";
import createHttpError from "http-errors";
import pool from "../config/db.config.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { hashPassword } from "../utils/password.js";

export const createUser = asyncHandler(async (req, res) => {
  const { name, role, password, user_name } = req.body;

  if (!name || !user_name || !password || !role) {
    throw createHttpError(400, "All fields required");
  }

  if (!["ADMIN", "MANAGER", "CASHIER"].includes(role)) {
    throw createHttpError(400, "Invalid role");
  }

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (name, user_name, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, user_name, role`,
    [name, user_name, passwordHash, role]
  );
  res.json(
    getSuccessResponse({
      data: result.rows[0],
      message: "User created successfully",
      status: 201,
    }),
  );
});
