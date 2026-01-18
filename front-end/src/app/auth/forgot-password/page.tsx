"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState(""); // e-mail ou telefone formatado
  const [rawValue, setRawValue] = useState(""); // telefone sem máscara
  const [code, setCode] = useState(""); // código enviado
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [codeSent, setCodeSent] = useState(false); // controla exibição da caixinha

  // Verifica se é e-mail
  const isEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  // Formata telefone (apenas quando o usuário termina de digitar)
  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 10)
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(
        6
      )}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  const handleChange = (value: string) => {
    setIdentifier(value);
    setRawValue(value.replace(/\D/g, ""));
  };

  const handleBlur = () => {
    const cleaned = identifier.replace(/\D/g, "");
    if (cleaned.length >= 10 && !/[a-zA-Z@]/.test(identifier)) {
      setIdentifier(formatPhone(identifier));
    }
  };

  // Envia código (simulado)
  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) {
      setMessage("Por favor, insira seu e-mail ou número de telefone.");
      return;
    }

    const isPhone = rawValue.length >= 10;
    if (!isEmail(identifier) && !isPhone) {
      setMessage("Digite um e-mail ou número de telefone válido.");
      return;
    }

    setLoading(true);
    setMessage("");

    setTimeout(() => {
      setLoading(false);
      setCodeSent(true);
      if (isEmail(identifier)) {
        setMessage(`Enviamos um código para o e-mail ${identifier}.`);
      } else {
        setMessage(`Enviamos um código para o número ${identifier}.`);
      }
    }, 1200);
  };

  // Confirma código (simulado)
  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      setMessage("Por favor, insira o código recebido.");
      return;
    }

    setLoading(true);
    setMessage("");

    setTimeout(() => {
      setLoading(false);
      if (code === "123456") {
        setMessage("✅ Código verificado com sucesso! Agora redefina sua senha.");
      } else {
        setMessage("❌ Código inválido. Tente novamente.");
      }
    }, 1000);
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
          Recuperar Senha
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Digite seu e-mail ou número de telefone para receber o código de recuperação.
        </Typography>

        {/* Campo e envio de código */}
        <form onSubmit={handleSendCode}>
          <TextField
            label="E-mail ou telefone"
            fullWidth
            value={identifier}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": { borderRadius: 4 },
            }}
            inputProps={{ maxLength: 50 }}
            disabled={codeSent}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || codeSent}
            sx={{ borderRadius: 4 }}
          >
            {loading ? <CircularProgress size={24} /> : "Enviar código"}
          </Button>
        </form>

        {/* Campo de código aparece abaixo */}
        {codeSent && (
          <form onSubmit={handleVerifyCode}>
            <TextField
              label="Código de verificação"
              fullWidth
              value={code}
              onChange={(e) => setCode(e.target.value)}
              sx={{
                mb: 2,
                mt: 3,
                "& .MuiOutlinedInput-root": { borderRadius: 4 },
              }}
              inputProps={{ maxLength: 6 }}
            />
            <Button
              type="submit"
              variant="contained"
              color="success"
              fullWidth
              disabled={loading}
              sx={{ borderRadius: 4 }}
            >
              {loading ? <CircularProgress size={24} /> : "Verificar código"}
            </Button>
          </form>
        )}

        {/* Mensagem de feedback */}
        {message && (
          <Typography color="text.secondary" align="center" mt={2} fontSize={14}>
            {message}
          </Typography>
        )}

        {/* Voltar para login */}
        <Box mt={3} textAlign="center">
          <Typography
            variant="body2"
            color="primary"
            sx={{ cursor: "pointer" }}
            onClick={() => (window.location.href = "/auth/login")}
          >
            Voltar para login
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
