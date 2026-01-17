"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import Image from "next/image";
import logo from "@/assets/logo.png";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Verifica se as senhas coincidem
  useEffect(() => {
    if (confirmPassword && password !== confirmPassword) {
      setError("As senhas não coincidem.");
    } else {
      setError("");
    }
  }, [password, confirmPassword]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setMessage("Preencha todos os campos.");
      return;
    }

    if (password.length < 6) {
      setMessage("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setMessage("");

    // Simula envio ao backend
    setTimeout(() => {
      setLoading(false);
      setMessage("✅ Senha redefinida com sucesso! Redirecionando para o login...");

      // Redireciona para login após 2 segundos
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    }, 1500);
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: 3,
      }}
    >
      {/* Logo circular fora da caixa */}
      <Box
        sx={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          overflow: "hidden",
        }}
      >
        <Image
          src={logo}
          alt="Logo da Clínica"
          width={120}
          height={120}
          style={{ objectFit: "cover" }}
        />
      </Box>

      {/* Caixa principal */}
      <Paper
        elevation={8}
        sx={{
          p: 4,
          borderRadius: 6,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Redefinir Senha
        </Typography>

        <Typography variant="body2" color="text.secondary" mb={3}>
          Crie uma nova senha para acessar sua conta.
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Nova senha"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": { borderRadius: 4 },
            }}
          />

          <TextField
            label="Confirmar senha"
            type="password"
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={!!error}
            helperText={error}
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": { borderRadius: 4 },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            sx={{ borderRadius: 4 }}
          >
            {loading ? <CircularProgress size={24} /> : "Redefinir senha"}
          </Button>
        </form>

        {message && (
          <Typography
            align="center"
            mt={2}
            color="text.secondary"
            fontSize={14}
          >
            {message}
          </Typography>
        )}

        <Box mt={3} textAlign="center">
          <Typography
            variant="body2"
            color="primary"
            sx={{ cursor: "pointer" }}
            onClick={() => router.push("/auth/login")}
          >
            Voltar para login
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
