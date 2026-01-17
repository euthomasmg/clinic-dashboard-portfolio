"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { CheckCircleOutlineRounded } from "@mui/icons-material";
import { useRouter } from "next/navigation";

const CODE_LENGTH = 6;
const DEFAULT_CONTACT = {
  email: "alex.ribeiro@clinica.com",
  phone: "(11) 98888-1234",
};
const TEST_CODE = "123456";

type PendingChanges = {
  emailChanged?: boolean;
  phoneChanged?: boolean;
  usernameChanged?: boolean;
  passwordChanged?: boolean;
  previousEmail?: string;
  previousPhone?: string;
  previousUsername?: string;
  newEmail?: string;
  newPhone?: string;
  newUsername?: string;
  newPassword?: string;
};

export default function ConfirmPage() {
  const router = useRouter();

  const [contactEmail, setContactEmail] = useState(DEFAULT_CONTACT.email);
  const [contactPhone, setContactPhone] = useState(DEFAULT_CONTACT.phone);
  const [pendingFields, setPendingFields] = useState<string[]>([]);
  const [emailChanged, setEmailChanged] = useState(false);
  const [phoneChanged, setPhoneChanged] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<"email" | "phone" | null>(null);
  const [targetCode, setTargetCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingChannel, setLoadingChannel] = useState<"email" | "phone" | null>(null);
  const [nothingToConfirm, setNothingToConfirm] = useState(false);
  const [codeInputVisible, setCodeInputVisible] = useState(false);

  const handleSendCode = React.useCallback(
    (channel: "email" | "phone") => {
      setError("");
      setMessage("");
      setSelectedChannel(channel);
      setCodeInputVisible(false);
      const target = channel === "email" ? contactEmail : contactPhone;
      if (!target) {
        setError(channel === "email" ? "Nenhum e-mail cadastrado para confirmacao." : "Nenhum telefone cadastrado.");
        return;
      }
      setLoading(true);
      setLoadingChannel(channel);
      setTargetCode(TEST_CODE);
      setCode(TEST_CODE);
      setMessage(
        `Codigo enviado para ${channel === "email" ? "o e-mail" : "o telefone"} ${target}. Para teste, use ${TEST_CODE}.`
      );
      setCodeInputVisible(true);
      setTimeout(() => {
        setLoading(false);
        setLoadingChannel(null);
      }, 900);
    },
    [contactEmail, contactPhone]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem("pendingSensitiveChanges");
    if (!raw) {
      setNothingToConfirm(true);
      return;
    }

    try {
      const parsed: PendingChanges = JSON.parse(raw);
      const changed: string[] = [];
      if (parsed.emailChanged) changed.push("E-mail");
      if (parsed.phoneChanged) changed.push("Telefone");
      if (parsed.usernameChanged) changed.push("Usuario");
      if (parsed.passwordChanged) changed.push("Senha");
      setPendingFields(changed);
      if (changed.length === 0) {
        setNothingToConfirm(true);
      }
      setEmailChanged(Boolean(parsed.emailChanged));
      setPhoneChanged(Boolean(parsed.phoneChanged));

      const targetEmail = parsed.newEmail || parsed.previousEmail || DEFAULT_CONTACT.email;
      const targetPhone = parsed.newPhone || parsed.previousPhone || DEFAULT_CONTACT.phone;
      setContactEmail(targetEmail);
      setContactPhone(targetPhone);
    } catch {
      setNothingToConfirm(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (nothingToConfirm) {
      router.push("/dashboard/profile");
      return;
    }

    if (!selectedChannel) {
      setError("Escolha se prefere confirmar por telefone ou e-mail.");
      return;
    }

    if (!targetCode) {
      setError("Envie o codigo antes de confirmar.");
      return;
    }

    if (code.length !== CODE_LENGTH) {
      setError(`Digite o codigo de ${CODE_LENGTH} digitos.`);
      return;
    }

    if (code !== targetCode) {
      setError("Codigo incorreto. Tente novamente.");
      return;
    }

    setSuccess(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("pendingSensitiveChanges");
    }
  };

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.replace("/dashboard/profile");
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [success]);

  const isEmailDisabled = selectedChannel === "phone";
  const isPhoneDisabled = selectedChannel === "email";
  const cardDisabledSx = {
    opacity: 0.5,
    filter: "grayscale(0.6)",
    pointerEvents: "none",
  } as const;
  const hasContactChange = emailChanged || phoneChanged;
  const showEmailCard = emailChanged || !hasContactChange;
  const showPhoneCard = phoneChanged || !hasContactChange;
  const showChannelHelper = selectedChannel ? message || "Digite o codigo recebido no canal escolhido." : "";

  if (success) {
    return (
      <Container
        maxWidth="sm"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pt: { xs: 2, md: 4 },
          pb: { xs: 4, md: 6 },
        }}
      >
        <Paper
          elevation={8}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 6,
            width: "100%",
            textAlign: "center",
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, alignItems: "center" }}>
            <CheckCircleOutlineRounded color="success" sx={{ fontSize: 44 }} />
            <Typography variant="h5" fontWeight={700}>
              Alteracoes confirmadas
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Seus dados atualizados foram confirmados com sucesso. Redirecionando para o perfil...
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="sm"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pt: { xs: 1, md: 3 },
        pb: { xs: 4, md: 6 },
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={8}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 6,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Confirmar alteracoes do perfil
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Selecione onde quer receber o codigo de confirmacao: e-mail ou telefone ja cadastrados.
        </Typography>

        {pendingFields.length > 0 && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 1,
              mt: 2,
            }}
          >
            {pendingFields.map((field) => (
              <Chip key={field} label={`Alteracao em ${field}`} size="small" color="primary" variant="outlined" />
            ))}
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        {nothingToConfirm ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Nenhuma alteracao pendente para confirmar.
            </Typography>
            <Button variant="contained" onClick={() => router.push("/dashboard/profile")} sx={{ borderRadius: 4 }}>
              Voltar ao perfil
            </Button>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: showEmailCard && showPhoneCard ? "1fr 1fr" : "1fr",
                },
                gap: 1.5,
                mb: 3,
              }}
            >
              {showEmailCard && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 4,
                    borderColor: selectedChannel === "email" ? "primary.main" : "divider",
                    boxShadow: selectedChannel === "email" ? 4 : 0,
                    transition: "0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    alignItems: "flex-start",
                    ...(isEmailDisabled ? cardDisabledSx : {}),
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700}>
                    Confirmar por e-mail
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {contactEmail}
                  </Typography>
                  <Button
                    fullWidth
                    variant={selectedChannel === "email" ? "contained" : "outlined"}
                    onClick={() => handleSendCode("email")}
                    disabled={loading || isEmailDisabled}
                    sx={{ borderRadius: 3, mt: 1 }}
                  >
                    {loading && loadingChannel === "email" ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      "Enviar codigo por e-mail"
                    )}
                  </Button>
                </Paper>
              )}

              {showPhoneCard && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 4,
                    borderColor: selectedChannel === "phone" ? "primary.main" : "divider",
                    boxShadow: selectedChannel === "phone" ? 4 : 0,
                    transition: "0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    alignItems: "flex-start",
                    ...(isPhoneDisabled ? cardDisabledSx : {}),
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700}>
                    Confirmar por telefone
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {contactPhone}
                  </Typography>
                  <Button
                    fullWidth
                    variant={selectedChannel === "phone" ? "contained" : "outlined"}
                    onClick={() => handleSendCode("phone")}
                    disabled={loading || isPhoneDisabled}
                    sx={{ borderRadius: 3, mt: 1 }}
                  >
                    {loading && loadingChannel === "phone" ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      "Enviar codigo por telefone"
                    )}
                  </Button>
                </Paper>
              )}
            </Box>

            {codeInputVisible && (
              <TextField
                label="Codigo de 6 digitos"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                placeholder="Ex: 123456"
                inputProps={{ maxLength: CODE_LENGTH, inputMode: "numeric" }}
                fullWidth
                helperText={showChannelHelper}
              />
            )}

            {error && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={loading}
              sx={{ borderRadius: 4, mt: 2 }}
            >
              Confirmar alteracoes
            </Button>
          </>
        )}
      </Paper>
    </Container>
  );
}
