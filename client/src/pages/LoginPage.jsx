import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
} from "@mui/material";
import { Store as StoreIcon } from "@mui/icons-material";
import { authApi } from "../api/api";
import { getUserInfo } from "../utils/auth.utils";

const LoginPage = () => {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await authApi.login({ user_name: userName, password });

      // apiFetch returns data.data, but for login it might return just the object
      // depending on the getSuccessResponse wrapper in api.js
      // If apiFetch extracts data.data, we need to make sure data has the token.

      if (data && data.auth_token) {
        localStorage.setItem("token", data.auth_token);

        // Get role-based redirect
        const user = getUserInfo();
        if (user && user.role === "admin") {
          navigate("/admin");
        } else if (user && user.role === "cashier") {
          navigate("/cashier");
        } else {
          // Default fallback
          navigate("/cashier");
        }
      } else {
        throw new Error("Login failed: Token not received");
      }
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Container maxWidth="xs">
        <Card elevation={1}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  bgcolor: "primary.main",
                  mb: 2,
                }}
              >
                <StoreIcon sx={{ fontSize: 32, color: "white" }} />
              </Box>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Family POS
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to continue
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Username"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                disabled={loading}
                margin="normal"
                autoFocus
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                margin="normal"
                sx={{ mb: 3 }}
              />
              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ py: 1.5 }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", textAlign: "center", mt: 3 }}
        >
          © {new Date().getFullYear()} Family Mart. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
};

export default LoginPage;
