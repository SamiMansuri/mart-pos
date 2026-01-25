import "./src/config/env.js";
import { createServer } from "http";
import app from "./src/app.js";
import pool from "./src/config/db.config.js";

const PORT = process.env.PORT || 3000;

pool
  .query("SELECT NOW()")
  .then(() => {
    createServer(app).listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(() => {
    console.log("Server is not running.");
  });
