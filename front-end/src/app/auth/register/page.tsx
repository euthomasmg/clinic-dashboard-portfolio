"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Link,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Fade,
} from "@mui/material";

export default function RegisterPage() {
  const router = useRouter();

  // Estados principais
  const [firstName, setFirstName] = useState(""); // usa como nome completo
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cep, setCep] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState(""); // colaborador ou estagiário
  const [crp, setCrp] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  // Supervisores disponíveis (simulação)
  const supervisorsList = [
    "Dra. Ana Gabriele",
    "Dr. João Pereira",
    "Dra. Luiza Campos",
  ];

  // Formatação e validação
  const formatCpf = (value: string) =>
    value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);

  const formatPhone = (value: string) =>
    value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/g, "($1) $2")
      .replace(/(\d{5})(\d{4}).*/, "$1-$2")
      .slice(0, 15);

  const formatCep = (value: string) =>
    value
      .replace(/\D/g, "")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 9);

  const cleanNumber = (value: string) => value.replace(/\D/g, "");

  const isValidCPF = (value: string) => cleanNumber(value).length === 11;
  const isValidPhone = (value: string) => cleanNumber(value).length === 11;
  const isValidPassword = (value: string) => value.length >= 6;

  // Verificação de senha
  useEffect(() => {
    if (confirmPassword && password !== confirmPassword) {
      setError("As senhas não conferem!");
    } else {
      setError("");
    }
  }, [password, confirmPassword]);

  // Envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    // Fluxo específico para paciente: não exige usuário/senhas
    if (accountType === "paciente") {
      if (!firstName || !cpf || !email || !phone || !accountType) {
        setError("Preencha todos os campos obrigatórios!");
        return;
      }

      if (!isValidCPF(cpf)) {
        setError("O CPF deve conter 11 dígitos válidos!");
        return;
      }

      if (!isValidPhone(phone)) {
        setError("O número de telefone deve conter 11 dígitos (com DDD)!");
        return;
      }

      setError("");
      console.log("Novo usuário:", {
        firstName,
        cpf,
        email,
        phone,
        address,
        cep,
        addressNumber,
        addressComplement,
        username,
        accountType,
        crp,
        supervisor,
      });
      router.push("/auth/confirm");
      return;
    }

    if (
      !firstName ||
      !cpf ||
      !email ||
      !phone ||
      !username ||
      !password ||
      !confirmPassword ||
      !accountType
    ) {
      setError("Preencha todos os campos obrigatórios!");
      return;
    }

    if (!isValidCPF(cpf)) {
      setError("O CPF deve conter 11 dígitos válidos!");
      return;
    }

    if (!isValidPhone(phone)) {
      setError("O número de telefone deve conter 11 dígitos (com DDD)!");
      return;
    }

    if (!isValidPassword(password)) {
      setError("A senha deve ter pelo menos 6 caracteres!");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não conferem!");
      return;
    }

    if (accountType === "estagiario" && !supervisor) {
      setError("Selecione o supervisor!");
      return;
    }

    setError("");

    console.log("Novo usuário:", {
      firstName,
      cpf,
      email,
      phone,
      address,
      cep,
      addressNumber,
      addressComplement,
      username,
      accountType,
      crp,
      supervisor,
    });

    router.push("/auth/confirm");
  };

  const showError = (value: string) => touched && !value;

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
      {/* Logo circular */}
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
          Criar Conta
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Preencha os campos para se cadastrar
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          {/* Tipo de conta + campo dinâmico */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <FormControl
              fullWidth
              error={showError(accountType)}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            >
              <InputLabel id="account-type-label">Tipo de conta</InputLabel>
              <Select
                labelId="account-type-label"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                label="Tipo de conta"
              >
                <MenuItem value="colaborador">Colaborador</MenuItem>
                <MenuItem value="estagiario">Estagiário</MenuItem>
                <MenuItem value="administrativa">Administrativa</MenuItem>
                <MenuItem value="financeiro">Financeiro</MenuItem>
                <MenuItem value="paciente">Paciente</MenuItem>
              </Select>
              {showError(accountType) && (
                <Typography color="error" variant="caption">
                  Campo obrigatório
                </Typography>
              )}
            </FormControl>

            {/* Campo dinâmico */}
            <Fade in={accountType !== ""} timeout={300}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                {accountType === "estagiario" && (
                  <FormControl
                    fullWidth
                    error={showError(supervisor)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
                  >
                    <InputLabel id="supervisor-label">Supervisor</InputLabel>
                    <Select
                      labelId="supervisor-label"
                      value={supervisor}
                      onChange={(e) => setSupervisor(e.target.value)}
                      label="Supervisor"
                    >
                      {supervisorsList.map((name) => (
                        <MenuItem key={name} value={name}>
                          {name}
                        </MenuItem>
                      ))}
                    </Select>
                    {showError(supervisor) && (
                      <Typography color="error" variant="caption">
                        Campo obrigatório
                      </Typography>
                    )}
                  </FormControl>
                )}
              </Box>
            </Fade>
          </Box>

          {/* Nome completo */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Nome completo"
              fullWidth
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={showError(firstName)}
              helperText={showError(firstName) ? "Campo obrigatório" : ""}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
          </Box>

          {/* CPF e Telefone */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="CPF"
              fullWidth
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              inputProps={{ maxLength: 14 }}
              error={touched && (!cpf || !isValidCPF(cpf))}
              helperText={
                touched && !cpf
                  ? "Campo obrigatório"
                  : touched && !isValidCPF(cpf)
                  ? "CPF deve conter 11 dígitos"
                  : ""
              }
              placeholder="000.000.000-00"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Telefone"
              fullWidth
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              inputProps={{ maxLength: 15 }}
              error={touched && (!phone || !isValidPhone(phone))}
              helperText={
                touched && !phone
                  ? "Campo obrigatório"
                  : touched && !isValidPhone(phone)
                  ? "Número deve conter 11 dígitos (com DDD)"
                  : ""
              }
              placeholder="(00) 00000-0000"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
          </Box>

          {/* E-mail */}
          <TextField
            label="E-mail"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={showError(email)}
            helperText={showError(email) ? "Campo obrigatório" : ""}
            placeholder="seu@exemplo.com"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
          />

          {/* Endereco (opcional) */}
          <TextField
            label="Endereço"
            fullWidth
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua, avenida, travessa..."
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="CEP"
              fullWidth
              value={cep}
              onChange={(e) => setCep(formatCep(e.target.value))}
              inputProps={{ maxLength: 9 }}
              placeholder="00000-000"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Numero"
              fullWidth
              value={addressNumber}
              onChange={(e) =>
                setAddressNumber(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Numero"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
          </Box>
          {/* Nome de usuário */}
          {accountType !== "paciente" && (
            <TextField
              label="Nome de usuário"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={showError(username)}
              helperText={showError(username) ? "Campo obrigatório" : ""}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
          )}

          {/* Senhas */}
          {accountType !== "paciente" && (
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Senha"
                type="password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={touched && (!password || !isValidPassword(password))}
                helperText={
                  touched && !password
                    ? "Campo obrigatório"
                    : touched && !isValidPassword(password)
                    ? "Mínimo 6 caracteres"
                    : ""
                }
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
              />
              <TextField
                label="Confirmar senha"
                type="password"
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={touched && (!confirmPassword || password !== confirmPassword)}
                helperText={
                  touched && !confirmPassword
                    ? "Campo obrigatório"
                    : password !== confirmPassword
                    ? "As senhas não conferem"
                    : ""
                }
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
              />
            </Box>
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            sx={{ borderRadius: 4, mt: 1 }}
          >
            Criar conta
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
