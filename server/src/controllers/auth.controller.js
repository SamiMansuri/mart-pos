import { comparePassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import pool from "../config/db.config.js";
import createHttpError from "http-errors";
import { getSuccessResponse } from "../utils/response.util.js";
import { asyncHandler } from "../utils/asynHandler.util.js";

export const login = asyncHandler(async (req, res) => {
  const { user_name, password } = req.body;

  if (!user_name || !password) {
    throw createHttpError(400, "user_name and password required");
  }

  const result = await pool.query(
    "SELECT * FROM users WHERE user_name = $1 AND is_active = true",
    [user_name]
  );

  const user = result.rows[0];
  if (!user) {
    throw createHttpError(401, "Invalid credentials");
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    throw createHttpError(401, "Invalid credentials");
  }

  const token = signToken({
    user_id: user.id,
    role: user.role
  });

  res.json(
    getSuccessResponse({
      data: token,
      message: "Login successful",
      status: 200,
    }),
  );
});
