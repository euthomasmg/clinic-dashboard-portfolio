"use client";

import React, { useEffect, useState } from "react";
import { Avatar, Box, Button, Collapse, Divider, Paper, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import { alpha, useTheme } from "@mui/material/styles";
import { EmailRounded, PhoneRounded, BadgeRounded, HomeRounded, PersonRounded, LockRounded } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { mockUserProfile, type UserProfile, type UserProfileAddress } from "./userData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type UserAddressResponse = {
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  zip_code?: string;
} | null;

type UserApiResponse = {
  id?: string;
  full_name?: string;
  username?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  account_type?: string;
  address?: UserAddressResponse;
  created_at?: string | null;
};

const cleanCpf = (value: string) => value.replace(/\D/g, "").slice(0, 11);

const formatCPF = (value: string) => {
  const digits = cleanCpf(value);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  let formatted = part1;
  if (part2) formatted += `.${part2}`;
  if (part3) formatted += `.${part3}`;
  if (part4) formatted += `-${part4}`;
  return formatted;
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const middle = digits.length > 10 ? digits.slice(2, 7) : digits.slice(2, 6);
  const end = digits.length > 10 ? digits.slice(7, 11) : digits.slice(6, 10);
  let formatted = ddd ? `(${ddd}` : "";
  if (ddd && digits.length >= 3) formatted += ") ";
  if (middle) formatted += middle;
  if (end) formatted += `-${end}`;
  return formatted;
};

const cleanCep = (value: string) => value.replace(/\D/g, "").slice(0, 8);

const formatCep = (value: string) => {
  const digits = cleanCep(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const formatAddressDisplay = (address: UserProfileAddress) => {
  const streetNumber = [address.street, address.number].filter(Boolean).join(", ");
  const district = address.district ? address.district : "";
  const cityState = [address.city, address.state].filter(Boolean).join(" / ");
  const baseLine = [streetNumber, district, cityState]
    .filter((part) => part && `${part}`.trim())
    .join(" - ");
  const extras = [
    address.complement,
    address.zip_code ? `CEP: ${formatCep(address.zip_code)}` : "",
  ]
    .filter((part) => part && `${part}`.trim())
    .join(" | ");
  return [baseLine, extras].filter((part) => part && `${part}`.trim()).join(" | ");
};

const mapAddressFromApi = (address?: UserAddressResponse): UserProfileAddress => ({
  street: address?.street ?? "",
  number: address?.number ?? "",
  complement: address?.complement ?? "",
  district: address?.district ?? "",
  city: address?.city ?? "",
  state: address?.state ?? "",
  zip_code: address?.zip_code ? formatCep(address.zip_code) : "",
});

const mapProfileFromApi = (profile: UserApiResponse): UserProfile => ({
  name: profile.full_name ?? "",
  role: profile.account_type ?? "",
  username: profile.username ?? "",
  password: mockUserProfile.password,
  email: profile.email ?? "",
  phone: formatPhone(profile.phone ?? ""),
  document: formatCPF(profile.cpf ?? ""),
  address: mapAddressFromApi(profile.address ?? undefined),
  createdAt: profile.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "",
});

const cloneProfile = (profile: UserProfile): UserProfile => ({
  ...profile,
  address: { ...profile.address },
});

const parseErrorDetail = async (res: Response) => {
  try {
    const data = await res.json();
    const detail = (data as { detail?: unknown })?.detail;
    if (!detail) return "Erro ao salvar dados.";
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
            return "";
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
        return "Erro ao salvar dados.";
      }
    }
    return String(detail);
  } catch {
    return "Erro ao salvar dados.";
  }
};

export default function ProfilePage() {
  const theme = useTheme();
  const router = useRouter();
  const [data, setData] = useState<UserProfile>(cloneProfile(mockUserProfile));
  const [lastSavedData, setLastSavedData] = useState<UserProfile>(cloneProfile(mockUserProfile));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [contactEditing, setContactEditing] = useState(false);
  const [identityEditing, setIdentityEditing] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [identityMessage, setIdentityMessage] = useState("");
  const [identitySaving, setIdentitySaving] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  type ContactField = "username" | "email" | "phone" | "password";
  const sensitiveFields: ContactField[] = ["phone", "email", "password"];
  const requiredFields: ContactField[] = ["username", "email", "phone"];
  const [formError, setFormError] = useState("");
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordApiError, setPasswordApiError] = useState("");
  const [passwordApiMessage, setPasswordApiMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    async function loadProfileFromApi() {
      if (typeof window === "undefined") return;
      const storedUserId = window.localStorage.getItem("currentUserId");
      if (!storedUserId) {
        setLoadError("Usuario nao identificado. Faca login novamente.");
        setLoading(false);
        router.push("/auth/login");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          headers: { "X-User-Id": storedUserId },
        });
        if (!res.ok) {
          if (res.status === 401) {
            setLoadError("Sessao expirada. Faca login novamente.");
            router.push("/auth/login");
            return;
          }
          const errorData = await res.json().catch(() => ({}));
          throw new Error((errorData as { detail?: string }).detail || "Falha ao carregar perfil");
        }
        const profile: UserApiResponse = await res.json();
        const mappedProfile = mapProfileFromApi(profile);
        setData(cloneProfile(mappedProfile));
        setLastSavedData(cloneProfile(mappedProfile));
        setIdentityMessage("");
        setIdentityError("");
        if (profile.full_name) window.localStorage.setItem("currentUserName", profile.full_name);
        if (profile.username) window.localStorage.setItem("currentUsername", profile.username);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    }
    loadProfileFromApi();
  }, [router]);

  const initials = data.name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const contactItems: Array<{ key: ContactField; label: string; icon: React.ReactNode; readOnly?: boolean }> = [
    { key: "username", label: "Usuario", icon: <PersonRounded fontSize="small" /> },
    { key: "email", label: "E-mail", icon: <EmailRounded fontSize="small" /> },
    { key: "phone", label: "Telefone", icon: <PhoneRounded fontSize="small" /> },
    { key: "password", label: "Senha de acesso", icon: <LockRounded fontSize="small" />, readOnly: true },
  ];

  const iconBoxStyle = {
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 2,
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
  } as const;

  const inputRoundedSx = {
    "& .MuiOutlinedInput-root": { borderRadius: 2 },
  } as const;

  const getDisplayValue = (key: ContactField) => {
    return data[key] as string;
  };

  const buildAddressPayload = (address: UserProfileAddress) => {
    const cepDigits = cleanCep(address.zip_code);
    const stateValue = address.state.trim().toUpperCase();
    return {
      street: address.street.trim() || null,
      number: address.number.trim() || null,
      complement: address.complement.trim() || null,
      district: address.district.trim() || null,
      city: address.city.trim() || null,
      state: stateValue || null,
      zip_code: cepDigits || null,
    };
  };

  const handleIdentityCancel = () => {
    setData(cloneProfile(lastSavedData));
    setIdentityEditing(false);
    setIdentityError("");
    setIdentityMessage("");
  };

  const handleIdentitySave = async () => {
    setIdentityError("");
    setIdentityMessage("");

    const trimmedName = data.name.trim();
    const cpfDigits = cleanCpf(data.document);
    const cepDigits = cleanCep(data.address.zip_code);
    const stateValue = data.address.state.trim();

    if (!trimmedName) {
      setIdentityError("Informe o nome completo.");
      return;
    }
    if (cpfDigits.length !== 11) {
      setIdentityError("CPF invalido.");
      return;
    }
    if (cepDigits && cepDigits.length !== 8) {
      setIdentityError("CEP deve ter 8 digitos.");
      return;
    }
    if (stateValue && stateValue.length !== 2) {
      setIdentityError("UF deve ter 2 letras.");
      return;
    }

    const userId = typeof window !== "undefined" ? window.localStorage.getItem("currentUserId") : null;
    if (!userId) {
      setIdentityError("Usuario nao identificado.");
      return;
    }

    const payload: Record<string, unknown> = {
      full_name: trimmedName,
      cpf: cpfDigits,
      address: buildAddressPayload(data.address),
    };

    setIdentitySaving(true);
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (res.status === 401) {
          setLoadError("Sessao expirada. Faca login novamente.");
          router.push("/auth/login");
          return;
        }
        const message = await parseErrorDetail(res);
        throw new Error(message);
      }
      const profile: UserApiResponse = await res.json();
      const mapped = mapProfileFromApi(profile);
      setData(cloneProfile(mapped));
      setLastSavedData(cloneProfile(mapped));
      setIdentityEditing(false);
      setIdentityMessage("Dados atualizados com sucesso.");
      setLoadError("");
      if (profile.full_name) window.localStorage.setItem("currentUserName", profile.full_name);
      if (profile.username) window.localStorage.setItem("currentUsername", profile.username);
    } catch (err) {
      setIdentityError(err instanceof Error ? err.message : "Erro ao salvar dados.");
    } finally {
      setIdentitySaving(false);
    }
  };

  const handlePasswordResetSubmit = () => {
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();
    if (!trimmedNew || !trimmedConfirm) {
      setPasswordError("Preencha a nova senha e a confirmacao.");
      return;
    }
    if (trimmedNew.length < 8) {
      setPasswordError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      setPasswordError("As senhas nao coincidem.");
      return;
    }

    const userId = typeof window !== "undefined" ? window.localStorage.getItem("currentUserId") : null;
    if (!userId) {
      setPasswordError("Usuario nao identificado.");
      return;
    }

    setPasswordError("");
    setPasswordApiError("");
    setPasswordApiMessage("");
    setPasswordSaving(true);
    fetch(`${API_BASE}/users/me/password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId,
      },
      body: JSON.stringify({ new_password: trimmedNew }),
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            setLoadError("Sessao expirada. Faca login novamente.");
            router.push("/auth/login");
            return;
          }
          const message = await parseErrorDetail(res);
          throw new Error(message);
        }
        setPasswordApiMessage("Senha atualizada com sucesso.");
        setPasswordResetOpen(false);
        setNewPassword("");
        setConfirmPassword("");
      })
      .catch((err) => {
        setPasswordApiError(err instanceof Error ? err.message : "Erro ao atualizar senha.");
      })
      .finally(() => setPasswordSaving(false));
  };

  const renderList = (
    title: string,
    items: Array<{ key: ContactField; label: string; icon: React.ReactNode; readOnly?: boolean }>,
    editing: boolean,
    setEditing: (value: boolean) => void
  ) => (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        <Button
          size="small"
          disabled={passwordResetOpen || identityEditing}
          onClick={() => {
            if (editing) {
              setData(cloneProfile(lastSavedData));
              setEditing(false);
              setFormError("");
              return;
            }
            setPasswordResetOpen(false);
            setNewPassword("");
            setConfirmPassword("");
            setPasswordError("");
            setFormError("");
            setEditing(true);
          }}
        >
          {editing ? "Cancelar" : "Editar"}
        </Button>
      </Box>
      <Divider />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
        {items.map((item) => (
          <Box
            key={item.key as string}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.25,
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <Box sx={iconBoxStyle}>{item.icon}</Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color={theme.palette.text.secondary}>
                {item.label}
              </Typography>
              {editing && !item.readOnly ? (
                <TextField
                  size="small"
                  fullWidth
                  value={data[item.key] as string}
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    const formattedValue = item.key === "phone" ? formatPhone(rawValue) : rawValue;
                    setData((prev) => ({ ...prev, [item.key]: formattedValue }));
                    if (formError) setFormError("");
                  }}
                  sx={{ mt: 0.5, ...inputRoundedSx }}
                  type={item.key === "password" ? "password" : "text"}
                  error={editing && !`${data[item.key] ?? ""}`.trim()}
                  helperText={
                    editing && !`${data[item.key] ?? ""}`.trim()
                      ? "Campo obrigatorio"
                      : undefined
                  }
                />
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {item.key !== "password" && (
                    <Typography variant="body1" fontWeight={600}>
                      {getDisplayValue(item.key)}
                    </Typography>
                  )}
                  {item.key === "password" && (
                    <>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={contactEditing}
                        onClick={() => {
                          if (contactEditing) return;
                          setPasswordResetOpen((prev) => !prev);
                          setPasswordError("");
                          setPasswordApiError("");
                          setPasswordApiMessage("");
                          if (passwordResetOpen) {
                            setNewPassword("");
                            setConfirmPassword("");
                          }
                        }}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        Redefinir senha
                      </Button>
                      <Collapse in={passwordResetOpen} sx={{ width: "100%" }}>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 1 }}>
                          <TextField
                            label="Nova senha"
                            type="password"
                            size="small"
                            fullWidth
                            value={newPassword}
                            sx={inputRoundedSx}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              if (passwordError) setPasswordError("");
                            }}
                          />
                          <TextField
                            label="Confirmar senha"
                            type="password"
                            size="small"
                            fullWidth
                            value={confirmPassword}
                            sx={inputRoundedSx}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              if (passwordError) setPasswordError("");
                            }}
                          />
                          {passwordError && (
                            <Typography variant="body2" color="error">
                              {passwordError}
                            </Typography>
                          )}
                          {passwordApiError && (
                            <Typography variant="body2" color="error">
                              {passwordApiError}
                            </Typography>
                          )}
                          {passwordApiMessage && (
                            <Typography variant="body2" color="success.main">
                              {passwordApiMessage}
                            </Typography>
                          )}
                          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => {
                                setPasswordResetOpen(false);
                                setNewPassword("");
                                setConfirmPassword("");
                                setPasswordError("");
                                setPasswordApiError("");
                                setPasswordApiMessage("");
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button variant="contained" size="small" onClick={handlePasswordResetSubmit} disabled={passwordSaving}>
                              {passwordSaving ? "Salvando..." : "Salvar senha"}
                            </Button>
                          </Box>
                        </Box>
                      </Collapse>
                    </>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>
      {editing && formError && (
        <Typography color="error" variant="body2">
          {formError}
        </Typography>
      )}
      {editing && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setData(cloneProfile(lastSavedData));
              setEditing(false);
              setFormError("");
            }}
          >
            Cancelar edicao
          </Button>
          <Button
            variant="contained"
            size="small"
            disabled={contactSaving}
            onClick={async () => {
              const hasEmptyRequired = requiredFields.some((field) => !`${data[field] ?? ""}`.trim());
              if (hasEmptyRequired) {
                setFormError("Preencha todos os campos obrigatorios antes de salvar.");
                return;
              }

              const userId = typeof window !== "undefined" ? window.localStorage.getItem("currentUserId") : null;
              if (!userId) {
                setFormError("Usuario nao identificado.");
                return;
              }

              const emailChanged = data.email !== lastSavedData.email;
              const phoneChanged = data.phone !== lastSavedData.phone;
              const usernameChanged = data.username !== lastSavedData.username;
              const sensitiveChanged = emailChanged || phoneChanged;
              try {
                setContactSaving(true);
                if (usernameChanged) {
                  const res = await fetch(`${API_BASE}/users/me/username`, {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                      "X-User-Id": userId,
                    },
                    body: JSON.stringify({ new_username: data.username.trim() }),
                  });
                  if (!res.ok) {
                    if (res.status === 401) {
                      setLoadError("Sessao expirada. Faca login novamente.");
                      router.push("/auth/login");
                      return;
                    }
                    const message = await parseErrorDetail(res);
                    throw new Error(message);
                  }
                  const responseBody = (await res.json()) as { username?: string } | undefined;
                  if (responseBody?.username && typeof window !== "undefined") {
                    window.localStorage.setItem("currentUsername", responseBody.username);
                  } else if (typeof window !== "undefined") {
                    window.localStorage.setItem("currentUsername", data.username.trim());
                  }
                }

                setLastSavedData(cloneProfile(data));
                setEditing(false);
                setFormError("");

                if (typeof window !== "undefined") {
                  const pendingChanges = {
                    emailChanged,
                    phoneChanged,
                    previousEmail: lastSavedData.email,
                    previousPhone: lastSavedData.phone,
                    newEmail: data.email,
                    newPhone: data.phone,
                  };
                  if (emailChanged || phoneChanged) {
                    window.sessionStorage.setItem("pendingSensitiveChanges", JSON.stringify(pendingChanges));
                  } else {
                    window.sessionStorage.removeItem("pendingSensitiveChanges");
                  }
                  if (data.username) {
                    window.localStorage.setItem("currentUsername", data.username);
                  }
                }

                if (sensitiveChanged) {
                  router.push("/dashboard/confirm");
                }
              } catch (err) {
                setFormError(err instanceof Error ? err.message : "Erro ao salvar dados.");
              } finally {
                setContactSaving(false);
              }
            }}
          >
            {contactSaving ? "Salvando..." : "Salvar"}
          </Button>
        </Box>
      )}
    </Paper>
  );

  const renderIdentitySection = () => {
    const nameError = identityEditing && !data.name.trim();
    const cpfError = identityEditing && cleanCpf(data.document).length !== 11;
    const cepError =
      identityEditing && !!data.address.zip_code && cleanCep(data.address.zip_code).length !== 8;
    const stateError =
      identityEditing && !!data.address.state && data.address.state.trim().length !== 2;

    const identityItems = [
      { label: "Nome completo", value: data.name, icon: <PersonRounded fontSize="small" /> },
      { label: "CPF", value: data.document, icon: <BadgeRounded fontSize="small" /> },
      {
        label: "Endereco",
        value: formatAddressDisplay(data.address) || "Nao informado",
        icon: <HomeRounded fontSize="small" />,
      },
    ];

    return (
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Dados pessoais
          </Typography>
          <Button
            size="small"
            onClick={() => {
              if (identityEditing) {
                handleIdentityCancel();
                return;
              }
              if (contactEditing) {
                setData(cloneProfile(lastSavedData));
                setFormError("");
              }
              setContactEditing(false);
              setFormError("");
              setPasswordResetOpen(false);
              setIdentityError("");
              setIdentityMessage("");
              setIdentityEditing(true);
            }}
          >
            {identityEditing ? "Cancelar" : "Editar"}
          </Button>
        </Box>
        <Divider />

        {!identityEditing && identityMessage && (
          <Typography color="success.main" variant="body2">
            {identityMessage}
          </Typography>
        )}
        {!identityEditing && identityError && (
          <Typography color="error" variant="body2">
            {identityError}
          </Typography>
        )}

        {!identityEditing ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {identityItems.map((item) => (
              <Box
                key={item.label}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1.25,
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.primary.main, 0.04),
                }}
              >
                <Box sx={iconBoxStyle}>{item.icon}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color={theme.palette.text.secondary}>
                    {item.label}
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {item.value || "Nao informado"}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fit, minmax(260px, 1fr))" },
                gap: 1.5,
              }}
            >
              <TextField
                label="Nome completo"
                fullWidth
                value={data.name}
                sx={inputRoundedSx}
                onChange={(e) => {
                  setData((prev) => ({ ...prev, name: e.target.value }));
                  if (identityError) setIdentityError("");
                }}
                error={nameError}
                helperText={nameError ? "Campo obrigatorio" : undefined}
              />
              <TextField
                label="CPF"
                fullWidth
                value={data.document}
                sx={inputRoundedSx}
                onChange={(e) => {
                  setData((prev) => ({ ...prev, document: formatCPF(e.target.value) }));
                  if (identityError) setIdentityError("");
                }}
                placeholder="000.000.000-00"
                error={cpfError}
                helperText={cpfError ? "CPF invalido" : "Use apenas numeros"}
              />
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Endereco
              </Typography>
              <Grid container spacing={1.25}>
                <Grid item xs={12} sm={6} md={6}>
                  <TextField
                    label="Logradouro"
                    fullWidth
                    value={data.address.street}
                    sx={inputRoundedSx}
                    onChange={(e) => {
                      setData((prev) => ({
                        ...prev,
                        address: { ...prev.address, street: e.target.value },
                      }));
                      if (identityError) setIdentityError("");
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Numero"
                    fullWidth
                    value={data.address.number}
                    sx={inputRoundedSx}
                    onChange={(e) => {
                      setData((prev) => ({
                        ...prev,
                        address: {
                          ...prev.address,
                          number: e.target.value.replace(/\D/g, "").slice(0, 6),
                        },
                      }));
                      if (identityError) setIdentityError("");
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Complemento"
                    fullWidth
                    value={data.address.complement}
                    sx={inputRoundedSx}
                    onChange={(e) => {
                      setData((prev) => ({
                        ...prev,
                        address: { ...prev.address, complement: e.target.value },
                      }));
                      if (identityError) setIdentityError("");
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Bairro"
                    fullWidth
                    value={data.address.district}
                    sx={inputRoundedSx}
                    onChange={(e) => {
                      setData((prev) => ({
                        ...prev,
                        address: { ...prev.address, district: e.target.value },
                      }));
                      if (identityError) setIdentityError("");
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Cidade"
                    fullWidth
                    value={data.address.city}
                    sx={inputRoundedSx}
                    onChange={(e) => {
                      setData((prev) => ({
                        ...prev,
                        address: { ...prev.address, city: e.target.value },
                      }));
                      if (identityError) setIdentityError("");
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="CEP"
                    fullWidth
                    value={data.address.zip_code}
                    sx={inputRoundedSx}
                    onChange={(e) => {
                      setData((prev) => ({
                        ...prev,
                        address: { ...prev.address, zip_code: formatCep(e.target.value) },
                      }));
                      if (identityError) setIdentityError("");
                    }}
                    placeholder="00000-000"
                    error={cepError}
                    helperText={cepError ? "CEP deve ter 8 digitos" : undefined}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Estado (UF)"
                    fullWidth
                    value={data.address.state}
                    sx={inputRoundedSx}
                    onChange={(e) => {
                      setData((prev) => ({
                        ...prev,
                        address: { ...prev.address, state: e.target.value.toUpperCase().slice(0, 2) },
                      }));
                      if (identityError) setIdentityError("");
                    }}
                    placeholder="SP"
                    error={stateError}
                    helperText={stateError ? "Use 2 letras, ex: SP" : undefined}
                  />
                </Grid>
              </Grid>
            </Box>

            {identityError && (
              <Typography color="error" variant="body2">
                {identityError}
              </Typography>
            )}
            {identityMessage && (
              <Typography color="success.main" variant="body2">
                {identityMessage}
              </Typography>
            )}

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>
              <Button variant="outlined" size="small" onClick={handleIdentityCancel} disabled={identitySaving}>
                Cancelar
              </Button>
              <Button variant="contained" size="small" onClick={handleIdentitySave} disabled={identitySaving}>
                {identitySaving ? "Salvando..." : "Salvar"}
              </Button>
            </Box>
          </>
        )}
      </Paper>
    );
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          width: "100%",
        }}
      >
        <Typography variant="body1">Carregando perfil...</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        width: "100%",
        maxWidth: 1200,
        mx: "auto",
      }}
    >
      {loadError && (
        <Typography color="error" variant="body2">
          {loadError}
        </Typography>
      )}
      <Paper
        elevation={1}
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: 3,
          width: "100%",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2.5,
        }}
      >
        <Avatar
          sx={{
            width: 72,
            height: 72,
            bgcolor: theme.palette.primary.main,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {data.name}
            </Typography>
            <Typography variant="body2" color={theme.palette.text.secondary}>
              {data.role}
            </Typography>
            <Typography variant="caption" color={theme.palette.text.secondary} sx={{ display: "block", mt: 0.5 }}>
              Cadastro criado em {data.createdAt}
            </Typography>
          </Box>

        </Box>
      </Paper>

      {renderIdentitySection()}

      <Grid container spacing={0} sx={{ width: "100%" }}>
        <Grid item xs={12} sx={{ width: "100%" }}>
          {renderList("Contato e acesso", contactItems, contactEditing, setContactEditing)}
        </Grid>
      </Grid>
    </Box>
  );
}
