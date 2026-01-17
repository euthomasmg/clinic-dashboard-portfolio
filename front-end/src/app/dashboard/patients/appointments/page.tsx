"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Switch,
  Card,
  CardContent,
} from "@mui/material";
import {
  DatePicker,
  DateTimePicker,
  LocalizationProvider,
} from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import AddCircleOutlineRounded from "@mui/icons-material/AddCircleOutlineRounded";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type Patient = {
  id: string;
  full_name: string;
};

const TELECONSULTA_TYPE = "Teleconsulta";

const recurrenceFrequencyOptions = [
  { value: "daily", label: "Diariamente" },
  { value: "weekly", label: "Semanalmente" },
  { value: "biweekly", label: "A cada 2 semanas" },
  { value: "monthly", label: "Mensalmente" },
];

const recurrenceEndOptions = [
  { value: "never", label: "Sem data final" },
  { value: "after", label: "Apos um numero de ocorrencias" },
  { value: "onDate", label: "Em uma data especifica" },
];

export default function PatientAppointmentsPage() {
  const router = useRouter();

  const [patient, setPatient] = useState("");
  const [type, setType] = useState("");
  const [room, setRoom] = useState("");
  const [dateTime, setDateTime] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("weekly");
  const [recurrenceEndType, setRecurrenceEndType] = useState("never");
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState(4);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const roomList = [
    "Sala 1 - Terapia",
    "Sala 2 - Supervisao",
    "Sala 3 - Atendimento Infantil",
  ];
  const inputShapeStyles = {
    "& .MuiOutlinedInput-root": { borderRadius: 3 },
    "& .MuiOutlinedInput-notchedOutline": { borderRadius: 3 },
  };
  const roundedDateTimeStyles = {
    "& .MuiOutlinedInput-root": { borderRadius: 999 },
    "& .MuiOutlinedInput-notchedOutline": { borderRadius: 999 },
  };

  const recurrenceSummary = useMemo(() => {
    if (!isRecurring) return "";

    const frequencyLabel =
      recurrenceFrequencyOptions.find(
        (option) => option.value === recurrenceFrequency,
      )?.label ?? "";

    if (recurrenceEndType === "never") {
      return `${frequencyLabel}, por tempo indeterminado`;
    }

    if (recurrenceEndType === "after") {
      return `${frequencyLabel}, repetir ${recurrenceOccurrences}x`;
    }

    if (recurrenceEndType === "onDate" && recurrenceEndDate) {
      return `${frequencyLabel}, ate ${recurrenceEndDate.toLocaleDateString("pt-BR")}`;
    }

    return frequencyLabel;
  }, [
    isRecurring,
    recurrenceFrequency,
    recurrenceEndType,
    recurrenceOccurrences,
    recurrenceEndDate,
  ]);

  const selectedPatientName =
    patients.find((p) => p.id === patient)?.full_name ?? "";

  useEffect(() => {
    async function loadPatients() {
      const currentUserId =
        typeof window !== "undefined" ? localStorage.getItem("currentUserId") : null;
      if (!currentUserId) {
        setError("Usuario nao identificado.");
        setLoadingPatients(false);
        return;
      }
      setError("");
      setLoadingPatients(true);
      try {
        const res = await fetch(`${API_BASE}/patients`, {
          headers: { "X-User-Id": currentUserId },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Falha ao carregar pacientes");
        }
        const data = (await res.json()) as Patient[];
        setPatients(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar pacientes");
      } finally {
        setLoadingPatients(false);
      }
    }
    loadPatients();
  }, []);

  useEffect(() => {
    // Define valor inicial apenas no cliente para evitar mismatch na hidratacao.
    if (!dateTime) {
      setDateTime(new Date());
    }
  }, [dateTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    const userId =
      typeof window !== "undefined" ? localStorage.getItem("currentUserId") : null;
    if (!userId) {
      setSubmitError("Usuario nao identificado.");
      return;
    }
    if (!patient) {
      setSubmitError("Selecione um paciente.");
      return;
    }
    if (!dateTime) {
      setSubmitError("Informe a data e hora.");
      return;
    }

    setSubmitting(true);
    try {
      const startsAt = dateTime.toISOString();
      const endsAt = new Date(dateTime.getTime() + 60 * 60 * 1000).toISOString();
      const res = await fetch(`${API_BASE}/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify({
          patient_id: patient,
          starts_at: startsAt,
          ends_at: endsAt,
          type: type || "Presencial",
          room: room || null,
          notes: notes || null,
          status: "Em espera",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Erro ao criar agendamento");
      }
      const dateParam = startsAt.slice(0, 10);
      router.push(`/dashboard/schedule?date=${encodeURIComponent(dateParam)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao criar agendamento");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
          gap: 3,
        }}
      >
        <Paper
          elevation={2}
          sx={{
            p: 4,
            borderRadius: 3,
            border: "1px solid #e5e7eb",
            backgroundColor: "#fff",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            Dados da consulta
          </Typography>
          <Divider />
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: 3 }}
          >
            {submitError && (
              <Typography color="error" variant="body2">
                {submitError}
              </Typography>
            )}
            <FormControl fullWidth sx={inputShapeStyles}>
              <InputLabel id="patient-label">Paciente</InputLabel>
              <Select
                labelId="patient-label"
                value={patient}
                label="Paciente"
                onChange={(e) => setPatient(e.target.value)}
                disabled={loadingPatients || !!error}
              >
                {loadingPatients ? (
                  <MenuItem value="" disabled>
                    Carregando pacientes...
                  </MenuItem>
                ) : patients.length === 0 ? (
                  <MenuItem value="" disabled>
                    Nenhum paciente encontrado
                  </MenuItem>
                ) : (
                  patients.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.full_name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={inputShapeStyles}>
              <InputLabel id="type-label">Tipo de atendimento</InputLabel>
              <Select
                labelId="type-label"
                value={type}
                label="Tipo de atendimento"
                onChange={(e) => setType(e.target.value)}
              >
                <MenuItem value="Presencial">Presencial</MenuItem>
                <MenuItem value={TELECONSULTA_TYPE}>{TELECONSULTA_TYPE}</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={inputShapeStyles}>
              <InputLabel id="room-label">Sala</InputLabel>
              <Select
                labelId="room-label"
                value={room}
                label="Sala"
                onChange={(e) => setRoom(e.target.value)}
              >
                {roomList.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <LocalizationProvider
              dateAdapter={AdapterDateFns}
              adapterLocale={ptBR}
            >
              <DateTimePicker
                label="Data e hora"
                value={dateTime}
                onChange={(newValue) => setDateTime(newValue)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    variant: "outlined",
                    sx: roundedDateTimeStyles,
                  },
                }}
              />
            </LocalizationProvider>

            <Box
              sx={{
                border: "1px solid #e5e7eb",
                borderRadius: 3,
                p: 2,
                backgroundColor: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={isRecurring}
                    onChange={(event) => setIsRecurring(event.target.checked)}
                  />
                }
                label="Repetir consulta"
              />

              {isRecurring && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <FormControl fullWidth sx={inputShapeStyles}>
                    <InputLabel id="recurrence-frequency-label">
                      Frequencia
                    </InputLabel>
                    <Select
                      labelId="recurrence-frequency-label"
                      value={recurrenceFrequency}
                      label="Frequencia"
                      onChange={(event) =>
                        setRecurrenceFrequency(event.target.value)
                      }
                    >
                      {recurrenceFrequencyOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth sx={inputShapeStyles}>
                    <InputLabel id="recurrence-end-type-label">
                      Termina
                    </InputLabel>
                    <Select
                      labelId="recurrence-end-type-label"
                      value={recurrenceEndType}
                      label="Termina"
                      onChange={(event) =>
                        setRecurrenceEndType(event.target.value)
                      }
                    >
                      {recurrenceEndOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {recurrenceEndType === "after" && (
                    <TextField
                      label="Numero de ocorrencias"
                      type="number"
                      fullWidth
                      value={recurrenceOccurrences}
                      onChange={(event) =>
                        setRecurrenceOccurrences(
                          Math.max(2, Number(event.target.value) || 2),
                        )
                      }
                      sx={inputShapeStyles}
                      helperText="Inclui a consulta inicial"
                      inputProps={{ min: 2 }}
                    />
                  )}

                  {recurrenceEndType === "onDate" && (
                    <LocalizationProvider
                      dateAdapter={AdapterDateFns}
                      adapterLocale={ptBR}
                    >
                      <DatePicker
                        label="Termina em"
                        value={recurrenceEndDate}
                        onChange={(newValue) => setRecurrenceEndDate(newValue)}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            sx: inputShapeStyles,
                          },
                        }}
                      />
                    </LocalizationProvider>
                  )}
                </Box>
              )}
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 2,
                mt: 2,
              }}
            >
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => router.push("/dashboard/patients")}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<AddCircleOutlineRounded />}
                disabled={submitting}
              >
                {submitting ? "Criando..." : "Criar agendamento"}
              </Button>
            </Box>
          </Box>
        </Paper>

        <Card
          elevation={2}
          sx={{
            borderRadius: 3,
            border: "1px solid #e5e7eb",
            backgroundColor: "#fafafa",
            display: "flex",
            flexDirection: "column",
            height: "fit-content",
          }}
        >
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>
              Pre-visualizacao
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {selectedPatientName && (
              <Typography>
                <strong>Paciente:</strong> {selectedPatientName}
              </Typography>
            )}
            {type && (
              <Typography>
                <strong>Tipo:</strong> {type}
              </Typography>
            )}
            {room && (
              <Typography>
                <strong>Sala:</strong> {room}
              </Typography>
            )}
            {dateTime && (
              <Typography>
                <strong>Data:</strong>{" "}
                {new Date(dateTime).toLocaleString("pt-BR")}
              </Typography>
            )}
            {notes && (
              <Typography sx={{ mt: 1 }}>
                <strong>Observacoes:</strong> {notes}
              </Typography>
            )}

            {isRecurring && (
              <Typography sx={{ mt: 1 }}>
                <strong>Recorrencia:</strong> {recurrenceSummary}
              </Typography>
            )}

            {!selectedPatientName && !type && !room && !dateTime && (
              <Typography color="text.secondary" fontSize={14}>
                Nenhum dado preenchido ainda.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
