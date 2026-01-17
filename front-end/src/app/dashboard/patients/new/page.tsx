"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Divider,
  Fade,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const ACCOUNT_TYPE_MAP: Record<string, string> = {
  administrativa: "Administrativa",
  estagiario: "Estagiario",
  financeiro: "Financeiro",
  paciente: "Paciente",
  profissional: "Profissional",
};

const ALL_ACCOUNT_TYPES = ["administrativa", "estagiario", "financeiro", "paciente", "profissional"];
const PROFESSIONAL_ALLOWED_TYPES = ["estagiario", "paciente"];
const INTERN_ALLOWED_TYPES = ["paciente"];

const MAX_FULL_NAME = 100;

export default function NewPatientPage() {
  const theme = useTheme();
  const router = useRouter();

  const [firstName, setFirstName] = useState(""); // usa como nome completo
  const [username, setUsername] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cep, setCep] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [accountType, setAccountType] = useState("paciente");
  const [crp, setCrp] = useState("");
  // const [supervisor, setSupervisor] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState("");

  // const supervisorsList = ["Dra. Ana Gabriele", "Dr. Joao Pereira", "Dra. Luiza Campos"];
  const isProfessionalCreator = (currentUserRole || "").toLowerCase() === "profissional";
  const isInternCreator = (currentUserRole || "").toLowerCase() === "estagiario";
  const allowedAccountTypes = isProfessionalCreator
    ? PROFESSIONAL_ALLOWED_TYPES
    : isInternCreator
    ? INTERN_ALLOWED_TYPES
    : ALL_ACCOUNT_TYPES;

  // Helpers
  const formatCpf = (v: string) =>
    v
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);

  const formatPhone = (v: string) =>
    v
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/g, "($1) $2")
      .replace(/(\d{5})(\d{4}).*/, "$1-$2")
      .slice(0, 15);

  const formatCep = (v: string) =>
    v.replace(/\D/g, "").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 9);

  const clean = (v: string) => v.replace(/\D/g, "");
  const isValidCPF = (v: string) => clean(v).length === 11;
  const isValidPhone = (v: string) => clean(v).length === 11;
  const isValidPassword = (v: string) => v.length >= 6;
  const getUserId = () =>
    typeof window !== "undefined" ? localStorage.getItem("currentUserId") : null;
  const getUserRole = () =>
    typeof window !== "undefined" ? localStorage.getItem("currentUserRole") : null;

  const parseErrorDetail = async (res: Response) => {
    try {
      const data = await res.json();
      const detail = (data as { detail?: unknown })?.detail;
      if (!detail) return "Erro ao salvar cadastro.";
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) {
        return detail
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && "msg" in item) {
              const msg = (item as { msg?: string }).msg;
              const loc = (item as { loc?: unknown })?.loc;
              const locText = Array.isArray(loc) ? loc.join(".") : "";
              return locText ? `${locText}: ${msg}` : msg;
            }
            try {
              return JSON.stringify(item);
            } catch {
              return "Erro ao salvar cadastro.";
            }
          })
          .filter(Boolean)
          .join(" / ");
      }
      if (typeof detail === "object") {
        if ("msg" in (detail as { msg?: string })) return String((detail as { msg?: string }).msg);
        try {
          return JSON.stringify(detail);
        } catch {
          return "Erro ao salvar cadastro.";
        }
      }
      return String(detail);
    } catch {
      return "Erro ao salvar cadastro.";
    }
  };

  useEffect(() => {
    const storedRole = getUserRole();
    if (storedRole) {
      setCurrentUserRole(storedRole);
    }
  }, []);

  useEffect(() => {
    if (!allowedAccountTypes.includes(accountType)) {
      setAccountType(allowedAccountTypes[0]);
    }
  }, [accountType, allowedAccountTypes]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    setError("");

    if (!allowedAccountTypes.includes(accountType)) {
      const message = isProfessionalCreator
        ? "Conta profissional so pode criar Estagiario ou Paciente."
        : "Conta estagiario so pode criar Paciente.";
      setError(message);
      return;
    }

    const isPatient = accountType === "paciente";
    const cleanCpf = clean(cpf);
    const cleanPhone = clean(phone);
    const cleanCep = clean(cep);
    const accountTypeApi = ACCOUNT_TYPE_MAP[accountType] ?? accountType;
    const fullName = firstName.replace(/\s+/g, " ").trim();

    if (!fullName || (!isPatient && !username) || !cleanCpf || !email || !cleanPhone) {
      setError("Preencha todos os campos obrigatorios.");
      return;
    }
    if (!isValidCPF(cpf)) {
      setError("CPF invalido.");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Telefone invalido.");
      return;
    }
    if (cleanCep && cleanCep.length !== 8) {
      setError("CEP invalido.");
      return;
    }
    if (stateUf.trim() && stateUf.trim().length !== 2) {
      setError("UF invalida. Use 2 letras, ex: SP.");
      return;
    }

    if (fullName.length > MAX_FULL_NAME) {
      setError(`Nome completo deve ter no maximo ${MAX_FULL_NAME} caracteres.`);
      return;
    }

    const userId = getUserId();
    if (!userId) {
      setError("Usuario nao identificado.");
      return;
    }

    if (!isPatient) {
      if (!password || !confirmPassword) {
        setError("As senhas sao obrigatorias.");
        return;
      }
      if (!isValidPassword(password)) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        setError("As senhas nao conferem.");
        return;
      }
    }

    const addressPayload = {
      street: address.trim() || undefined,
      number: addressNumber.trim() || undefined,
      complement: addressComplement.trim() || undefined,
      district: district.trim() || undefined,
      city: city.trim() || undefined,
      state: stateUf.trim() ? stateUf.trim().toUpperCase() : undefined,
      zip_code: cleanCep || undefined,
    };
    const hasAddress = Object.values(addressPayload).some(Boolean);

    const basePayload = {
      full_name: fullName,
      cpf: cleanCpf,
      phone: cleanPhone,
      email,
      ...(hasAddress ? { address: addressPayload } : {}),
    };

    const payload = isPatient
      ? basePayload
      : {
          ...basePayload,
          username: username.trim(),
          password,
          account_type: accountTypeApi,
        };

    const endpoint = isPatient ? `${API_BASE}/auth/register/patient` : `${API_BASE}/auth/register/user`;

    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const message = await parseErrorDetail(res);
        throw new Error(message);
      }
      router.push("/dashboard/patients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  const showError = (v: string) => touched && !v;

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: "flex", flexDirection: "column", gap: 3 }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 5,
          borderRadius: 5,
          minHeight: "80vh",
          backgroundColor: theme.palette.background.paper,
          display: "flex",
          flexDirection: "column",
          gap: 5,
          boxShadow: theme.shadows[4],
        }}
      >
        {/* Tipo de conta */}
        <Box>
          <Typography variant="h6" fontWeight={600} mb={1}>
            Tipo de conta
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="account-type-label">Tipo de conta</InputLabel>
              <Select
                labelId="account-type-label"
                value={accountType}
                label="Tipo de conta"
                onChange={(e) => {
                  setAccountType(e.target.value);
                  setCrp("");
                  // setSupervisor("");
                  setPassword("");
                  setConfirmPassword("");
                  setError("");
                  setTouched(false);
                }}
              sx={{ borderRadius: 4 }}
            >
              {allowedAccountTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {ACCOUNT_TYPE_MAP[type] ?? type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

            {/* <Fade key={accountType} in={!!accountType} timeout={250}>
              <Box sx={{ flex: 1, minWidth: 260 }}>
                {accountType === "estagiario" && (
                  <FormControl fullWidth>
                    <InputLabel id="supervisor-label">Supervisor</InputLabel>
                    <Select
                      labelId="supervisor-label"
                      value={supervisor}
                      label="Supervisor"
                      onChange={(e) => setSupervisor(e.target.value)}
                      sx={{ borderRadius: 4 }}
                    >
                      {supervisorsList.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            </Fade> */}
          </Box>
        </Box>

        {/* Dados pessoais */}
        <Box>
          <Typography variant="h6" fontWeight={600} mb={1}>
            Dados pessoais
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 2,
            }}
          >
            <TextField
              label="Nome completo"
              fullWidth
              autoComplete="off"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={showError(firstName)}
              helperText={showError(firstName) && "Campo obrigatorio"}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            {accountType !== "paciente" && (
              <TextField
                label="Nome de usuario"
                fullWidth
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={showError(username)}
                helperText={showError(username) && "Campo obrigatorio"}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
              />
            )}
            <TextField
              label="CPF"
              fullWidth
              autoComplete="off"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              error={touched && (!cpf || !isValidCPF(cpf))}
              helperText={
                !cpf
                  ? touched && "Campo obrigatorio"
                  : !isValidCPF(cpf) && "CPF invalido"
              }
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Telefone"
              fullWidth
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              error={touched && (!phone || !isValidPhone(phone))}
              helperText={
                !phone
                  ? touched && "Campo obrigatorio"
                  : !isValidPhone(phone) && "Numero invalido"
              }
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            <TextField
              label="E-mail"
              type="email"
              fullWidth
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={showError(email)}
              helperText={showError(email) && "Campo obrigatorio"}
              placeholder="exemplo@email.com"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />

            {accountType !== "paciente" && (
              <>
                <TextField
                  label="Senha"
                  type="password"
                  fullWidth
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={touched && (!password || !isValidPassword(password))}
                  helperText={
                    !password
                      ? touched && "Campo obrigatorio"
                      : !isValidPassword(password) && "Minimo 6 caracteres"
                  }
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
                />
                <TextField
                  label="Confirmar senha"
                  type="password"
                  fullWidth
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={touched && (!confirmPassword || password !== confirmPassword)}
                  helperText={
                    !confirmPassword
                      ? touched && "Campo obrigatorio"
                      : password !== confirmPassword && "As senhas nao conferem"
                  }
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
                />
              </>
            )}
          </Box>
        </Box>

        {/* Endereco */}
        <Box>
          <Typography variant="h6" fontWeight={600} mb={1}>
            Endereco (opcional)
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 2,
            }}
          >
            <TextField
              label="Endereco"
              fullWidth
              autoComplete="off"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, avenida, travessa..."
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            <TextField
              label="CEP"
              fullWidth
              autoComplete="off"
              value={cep}
              onChange={(e) => setCep(formatCep(e.target.value))}
              placeholder="00000-000"
              error={!!cep && clean(cep).length > 0 && clean(cep).length !== 8}
              helperText={
                !!cep &&
                clean(cep).length > 0 &&
                clean(cep).length !== 8 &&
                "CEP invalido"
              }
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Numero"
              fullWidth
              autoComplete="off"
              value={addressNumber}
              onChange={(e) =>
                setAddressNumber(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Ex: 123"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Complemento"
              fullWidth
              autoComplete="off"
              value={addressComplement}
              onChange={(e) => setAddressComplement(e.target.value)}
              placeholder="Apartamento, bloco, referencia..."
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Bairro"
              fullWidth
              autoComplete="off"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Cidade"
              fullWidth
              autoComplete="off"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
            <TextField
              label="Estado (UF)"
              fullWidth
              autoComplete="off"
              value={stateUf}
              onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="SP"
              error={!!stateUf && stateUf.length !== 2}
              helperText={
                !!stateUf && stateUf.length !== 2 && "Use 2 letras, ex: SP"
              }
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 4 } }}
            />
          </Box>
        </Box>

        {error && (
          <Typography color="error" textAlign="center">
            {error}
          </Typography>
        )}

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => router.push("/dashboard/patients")}
            sx={{ borderRadius: 4 }}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="large"
            sx={{ borderRadius: 4 }}
            disabled={loading}
          >
            {loading ? "Salvando..." : "Salvar cadastro"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
