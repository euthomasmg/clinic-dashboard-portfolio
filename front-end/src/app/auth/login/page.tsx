"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Link,
} from "@mui/material";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      setError("Preencha todos os campos!");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Falha no login");
      }
      const data = await res.json();
      const loggedUser = (data as { user?: { id?: string; full_name?: string; username?: string } }).user;
      if (typeof window !== "undefined" && loggedUser) {
        if (loggedUser.id) {
          window.localStorage.setItem("currentUserId", loggedUser.id);
        }
        if (loggedUser.full_name) {
          window.localStorage.setItem("currentUserName", loggedUser.full_name);
        }
        if (loggedUser.username) {
          window.localStorage.setItem("currentUsername", loggedUser.username);
        }
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container
      maxWidth="sm"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        minHeight: "100vh",
        pt: 8,
        gap: 3,
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          overflow: "hidden",
          boxShadow: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
          Logo
        </Typography>
      </Box>

      {/* Card de login */}
      <Paper
        elevation={8}
        sx={{
          p: 4,
          borderRadius: 6,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Typography variant="h4" gutterBottom>
          Login
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Entre com suas credenciais
        </Typography>

        {/* Formulario */}
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TextField
            label="Email ou nome de usuario"
            variant="outlined"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{
              borderRadius: 4,
              "& .MuiOutlinedInput-root": { borderRadius: 4 },
            }}
          />

          <TextField
            label="Senha"
            type="password"
            variant="outlined"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{
              borderRadius: 4,
              "& .MuiOutlinedInput-root": { borderRadius: 4 },
            }}
          />

          {error && (
            <Typography color="error" variant="body2" mt={1}>
              {error}
            </Typography>
          )}

          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            sx={{ borderRadius: 4 }}
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </Box>

        {/* Esqueci senha (unico link mantido) */}
        <Box mt={3}>
          <Link href="/auth/forgot-password" underline="hover">
            Esqueci minha senha
          </Link>
        </Box>
      </Paper>
    </Container>
  );
}
