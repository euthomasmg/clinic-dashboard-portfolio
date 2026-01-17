"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import PersonIcon from "@mui/icons-material/Person";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type Patient = {
  id: string;
  full_name: string;
  username: string;
  account_type: string;
  cpf: string;
  email: string;
  phone?: string | null;
  address?: {
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
    zip_code: string;
  };
  created_at?: string | null;
};

type PatientDocument = {
  id: string;
  patient_id: string;
  original_name: string;
  content_type: string;
  size: number;
  download_url: string;
  created_at?: string | null;
};

const defaultPatient: Patient = {
  id: "",
  full_name: "Paciente não encontrado",
  username: "",
  account_type: "Paciente",
  cpf: "",
  email: "",
  phone: "",
};

type PatientForm = {
  full_name: string;
  cpf: string;
  email: string;
  phone: string;
  address: {
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
    zip_code: string;
  };
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

const cleanPhone = (value: string) => value.replace(/\D/g, "").slice(0, 11);
const formatPhoneInput = (value: string) => {
  const digits = cleanPhone(value);
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

const mapPatientToForm = (p: Patient): PatientForm => ({
  full_name: p.full_name || "",
  cpf: formatCPF(p.cpf || ""),
  email: p.email || "",
  phone: formatPhoneInput(p.phone || ""),
  address: {
    street: p.address?.street || "",
    number: p.address?.number || "",
    complement: p.address?.complement || "",
    district: p.address?.district || "",
    city: p.address?.city || "",
    state: p.address?.state || "",
    zip_code: formatCep(p.address?.zip_code || ""),
  },
});

const inputRoundedSx = {
  "& .MuiOutlinedInput-root": { borderRadius: 2 },
} as const;

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography fontWeight={600}>{value}</Typography>
    </Stack>
  );
}

export default function PatientDetailsPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      }
    >
      <PatientDetailsPageContent />
    </Suspense>
  );
}

function PatientDetailsPageContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId") ?? "";
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<PatientForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("currentUserId") : null;
    if (!stored) {
      setError("Usuario nao identificado");
    }
    setUserId(stored);
  }, []);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      setError("Paciente não encontrado");
      return;
    }
    const currentUserId = userId;
    if (!currentUserId) {
      return;
    }
    async function fetchPatient(userIdHeader: string) {
      try {
        const res = await fetch(`${API_BASE}/patients/${patientId}`, {
          headers: { "X-User-Id": userIdHeader },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Falha ao carregar paciente");
        }
        const data = (await res.json()) as Patient;
        setPatient(data);
        setForm(mapPatientToForm(data));
        setEditing(false);
        setFormError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar paciente");
      } finally {
        setLoading(false);
      }
    }
    fetchPatient(currentUserId);
  }, [patientId, userId]);

  useEffect(() => {
    if (!patientId) {
      setDocsLoading(false);
      return;
    }
    const currentUserId = userId;
    if (!currentUserId) {
      return;
    }
    async function fetchDocuments(userIdHeader: string) {
      setDocsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/patients/${patientId}/documents`, {
          headers: { "X-User-Id": userIdHeader },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Falha ao carregar documentos");
        }
        const data = (await res.json()) as PatientDocument[];
        setDocuments(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar documentos");
      } finally {
        setDocsLoading(false);
      }
    }
    fetchDocuments(currentUserId);
  }, [patientId, userId]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (file.type !== "application/pdf" && file.type !== "application/octet-stream") {
      alert("Envie apenas arquivos PDF.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Limite de 10MB por arquivo.");
      event.target.value = "";
      return;
    }
    if (!patientId) {
      setError("Paciente não encontrado");
      return;
    }
    if (!userId) {
      setError("Usuario nao identificado");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/patients/${patientId}/documents`, {
        method: "POST",
        headers: { "X-User-Id": userId },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Erro ao enviar arquivo");
      }
      const created = (await res.json()) as PatientDocument;
      setDocuments((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!patientId) {
      setError("Paciente não encontrado");
      return;
    }
    if (!userId) {
      setError("Usuario nao identificado");
      return;
    }
    const confirmed = window.confirm("Tem certeza que deseja deletar este PDF?");
    if (!confirmed) return;

    setDeletingDocId(docId);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}/documents/${docId}`, {
        method: "DELETE",
        headers: { "X-User-Id": userId },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Erro ao deletar arquivo");
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar arquivo");
    } finally {
      setDeletingDocId(null);
    }
  };

  const formatPhone = (phone?: string | null) => {
    if (!phone) return "—";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone;
  };

  const formatZip = (zip?: string | null) => {
    if (!zip) return "";
    const digits = zip.replace(/\D/g, "");
    if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return zip;
  };

  const formatSize = (size?: number) => {
    if (size === undefined || size === null) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadDocument = async (doc: PatientDocument) => {
    if (!patientId) {
      setError("Paciente não encontrado");
      return;
    }
    if (!userId) {
      setError("Usuario nao identificado");
      return;
    }
    setDownloadingDocId(doc.id);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}/documents/${doc.id}`, {
        headers: { "X-User-Id": userId },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Erro ao baixar arquivo");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = doc.original_name || "documento.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao baixar arquivo");
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleDelete = async () => {
    if (!patientId) {
      setError("Paciente não encontrado");
      return;
    }
    if (!userId) {
      setError("Usuario nao identificado");
      return;
    }
    const confirmed = window.confirm("Tem certeza que deseja deletar este paciente?");
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}`, {
        method: "DELETE",
        headers: { "X-User-Id": userId },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Erro ao deletar paciente");
      }
      router.push("/dashboard/patients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar paciente");
    } finally {
      setDeleting(false);
    }
  };

  const handleStartEdit = () => {
    if (!patient) return;
    setForm(mapPatientToForm(patient));
    setEditing(true);
    setFormError("");
    setError("");
  };

  const handleCancelEdit = () => {
    if (patient) {
      setForm(mapPatientToForm(patient));
    }
    setEditing(false);
    setSaving(false);
    setFormError("");
  };

  const handleSaveEdit = async () => {
    if (!patientId) {
      setFormError("Paciente não encontrado");
      return;
    }
    if (!userId) {
      setFormError("Usuário não identificado.");
      return;
    }
    if (!form) return;

    const toOptionalField = (value: string) => {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };

    const trimmedName = form.full_name.trim();
    const cpfDigits = cleanCpf(form.cpf);
    const phoneDigits = cleanPhone(form.phone);
    const cepDigits = cleanCep(form.address.zip_code);
    const stateValue = form.address.state.trim();
    const emailValue = form.email.trim();

    if (!trimmedName) {
      setFormError("Informe o nome completo.");
      return;
    }
    if (cpfDigits.length !== 11) {
      setFormError("CPF inválido.");
      return;
    }
    if (!emailValue) {
      setFormError("Informe o e-mail.");
      return;
    }
    if (phoneDigits && phoneDigits.length < 10) {
      setFormError("Telefone inválido.");
      return;
    }
    if (cepDigits && cepDigits.length !== 8) {
      setFormError("CEP deve ter 8 dígitos.");
      return;
    }
    if (stateValue && stateValue.length !== 2) {
      setFormError("UF deve ter 2 letras.");
      return;
    }

    const payload = {
      full_name: trimmedName,
      cpf: cpfDigits,
      email: emailValue,
      phone: phoneDigits || null,
      address: {
        street: toOptionalField(form.address.street),
        number: toOptionalField(form.address.number),
        complement: toOptionalField(form.address.complement),
        district: toOptionalField(form.address.district),
        city: toOptionalField(form.address.city),
        state: stateValue || null,
        zip_code: cepDigits || null,
      },
    };

    setSaving(true);
    setFormError("");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail || "Erro ao salvar paciente");
      }
      const updated = (await res.json()) as Patient;
      setPatient(updated);
      setForm(mapPatientToForm(updated));
      setEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar paciente");
    } finally {
      setSaving(false);
    }
  };

  const p = patient ?? defaultPatient;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <Stack spacing={3}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <PersonIcon color="primary" />
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {p.full_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tipo: {p.account_type}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<EditRoundedIcon />}
                  onClick={editing ? handleCancelEdit : handleStartEdit}
                  disabled={deleting || loading || saving || !patient}
                >
                  {editing ? "Cancelar edição" : "Editar paciente"}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={handleDelete}
                  disabled={deleting || saving}
                >
                  {deleting ? "Deletando..." : "Deletar paciente"}
                </Button>
              </Stack>
            </Stack>

            <Divider />

            {editing && form ? (
              <Stack spacing={2.5}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Nome completo"
                      fullWidth
                      value={form.full_name}
                      sx={inputRoundedSx}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, full_name: e.target.value } : prev))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="CPF"
                      fullWidth
                      value={form.cpf}
                      sx={inputRoundedSx}
                      onChange={(e) =>
                        setForm((prev) => (prev ? { ...prev, cpf: formatCPF(e.target.value) } : prev))
                      }
                      placeholder="000.000.000-00"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Telefone"
                      fullWidth
                      value={form.phone}
                      sx={inputRoundedSx}
                      onChange={(e) =>
                        setForm((prev) => (prev ? { ...prev, phone: formatPhoneInput(e.target.value) } : prev))
                      }
                      placeholder="(11) 98888-0000"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="E-mail"
                      fullWidth
                      value={form.email}
                      sx={inputRoundedSx}
                      onChange={(e) => setForm((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
                      placeholder="email@exemplo.com"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Logradouro"
                      fullWidth
                      value={form.address.street}
                      sx={inputRoundedSx}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev ? { ...prev, address: { ...prev.address, street: e.target.value } } : prev
                        )
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Número"
                      fullWidth
                      value={form.address.number}
                      sx={inputRoundedSx}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev ? { ...prev, address: { ...prev.address, number: e.target.value } } : prev
                        )
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Complemento"
                      fullWidth
                      value={form.address.complement}
                      sx={inputRoundedSx}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev ? { ...prev, address: { ...prev.address, complement: e.target.value } } : prev
                        )
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Bairro"
                      fullWidth
                      value={form.address.district}
                      sx={inputRoundedSx}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev ? { ...prev, address: { ...prev.address, district: e.target.value } } : prev
                        )
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Cidade"
                      fullWidth
                      value={form.address.city}
                      sx={inputRoundedSx}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev ? { ...prev, address: { ...prev.address, city: e.target.value } } : prev
                        )
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Estado (UF)"
                      fullWidth
                      value={form.address.state}
                      sx={inputRoundedSx}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? { ...prev, address: { ...prev.address, state: e.target.value.toUpperCase().slice(0, 2) } }
                            : prev
                        )
                      }
                      placeholder="SP"
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="CEP"
                      fullWidth
                      value={form.address.zip_code}
                      sx={inputRoundedSx}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev ? { ...prev, address: { ...prev.address, zip_code: formatCep(e.target.value) } } : prev
                        )
                      }
                      placeholder="00000-000"
                    />
                  </Grid>
                </Grid>
                {formError && (
                  <Typography color="error" variant="body2">
                    {formError}
                  </Typography>
                )}
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" onClick={handleCancelEdit} disabled={saving || deleting}>
                    Cancelar
                  </Button>
                  <Button variant="contained" onClick={handleSaveEdit} disabled={saving || deleting}>
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <InfoItem label="Nome completo" value={p.full_name || "—"} />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <InfoItem label="CPF" value={p.cpf || "—"} />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <InfoItem label="Telefone" value={formatPhone(p.phone)} />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <InfoItem label="Email" value={p.email || "—"} />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <InfoItem
                    label="Cadastrado"
                    value={p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "—"}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <InfoItem
                    label="Endereço"
                    value={
                      p.address
                        ? `${p.address.street}, ${p.address.number}${
                            p.address.complement ? ` - ${p.address.complement}` : ""
                          } - ${p.address.district}, ${p.address.city}/${p.address.state} - ${formatZip(
                            p.address.zip_code
                          )}`
                        : "—"
                    }
                  />
                </Grid>
              </Grid>
            )}
          </Stack>
        )}
      </Paper>

      <Paper elevation={2} sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <InsertDriveFileIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Documentos do paciente
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Armazene relatórios, autorizações e PDFs importantes aqui.
              </Typography>
            </Box>
          </Stack>

          <Button
            component="label"
            variant="contained"
            startIcon={<UploadFileIcon />}
            disabled={uploading || deleting}
          >
            {uploading ? "Enviando..." : "Adicionar PDF"}
            <input
              hidden
              type="file"
              accept="application/pdf"
              onChange={handleUpload}
              data-testid="patient-upload-input"
            />
          </Button>

          {docsLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={22} />
              <Typography color="text.secondary">Carregando documentos...</Typography>
            </Box>
          ) : documents.length === 0 ? (
            <Typography color="text.secondary">Nenhum documento anexado ainda.</Typography>
          ) : (
            <Stack spacing={2}>
              {documents.map((documento) => {
                const isDeletingDoc = deletingDocId === documento.id;
                const isDownloading = downloadingDocId === documento.id;
                return (
                  <Paper
                    key={documento.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" },
                      gap: 2,
                      justifyContent: "space-between",
                      alignItems: { xs: "flex-start", sm: "center" },
                    }}
                  >
                    <Box>
                      <Typography fontWeight={600}>{documento.original_name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatSize(documento.size)}
                        {documento.created_at
                          ? ` • ${new Date(documento.created_at).toLocaleDateString("pt-BR")}`
                          : ""}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button
                        onClick={() => handleDownloadDocument(documento)}
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        disabled={isDownloading || deleting}
                      >
                        {isDownloading ? "Baixando..." : "Baixar PDF"}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => handleDeleteDocument(documento.id)}
                        disabled={isDeletingDoc || deleting}
                      >
                        {isDeletingDoc ? "Removendo..." : "Excluir"}
                      </Button>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
