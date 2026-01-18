"use client";

import { useEffect, useState, type Ref } from "react";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Portuguese } from "flatpickr/dist/l10n/pt.js";
import {
  Box,
  Paper,
  Typography,
  Divider,
  useTheme,
  Button,
  Link as MuiLink,
  IconButton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useRouter, useSearchParams } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";

type AppointmentStatus =
  | "Confirmado"
  | "Em espera"
  | "Cancelado"
  | "Reagendar"
  | "Recusado";

type Appointment = {
  id: string;
  patient_id: string;
  patient_name: string;
  starts_at: string;
  ends_at: string;
  type: string;
  room?: string | null;
  meeting_url?: string | null;
  status: AppointmentStatus;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
const PAGE_SIZE = 6;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const formatDateLabel = (dateStr: string | null) =>
  dateStr ? new Date(dateStr).toLocaleDateString("pt-BR") : "Selecione uma data";

const firstName = (name: string) => {
  if (!name) return "";
  const parts = name.trim().split(" ").filter(Boolean);
  return parts[0] ?? name;
};

export default function SchedulePage() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryDate = searchParams.get("date");

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedId = localStorage.getItem("currentUserId");
    const storedName = localStorage.getItem("currentUserName");
    setUserId(storedId);
    if (!storedId) {
      setError("Usuario nao identificado.");
    }
    setCurrentUserName(storedName || "");
  }, []);

  useEffect(() => {
    if (selectedDate) return;
    if (queryDate) {
      setSelectedDate(queryDate);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    setSelectedDate(today);
  }, [queryDate, selectedDate]);

  useEffect(() => {
    if (!selectedDate || !userId) return;
    setPage(1);
    setLoading(true);
    setError("");
    const url = `${API_BASE}/appointments?start_date=${selectedDate}&end_date=${selectedDate}`;
    fetch(url, {
      headers: { "X-User-Id": userId },
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Erro ao carregar agenda");
        }
        return res.json() as Promise<Appointment[]>;
      })
      .then((data) => {
        setAppointments(data ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar agenda");
      })
      .finally(() => setLoading(false));
  }, [selectedDate, userId]);

  const totalPages = Math.max(1, Math.ceil(appointments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedAppointments = appointments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handlePrevPage = () => setPage((prev) => Math.max(1, prev - 1));
  const handleNextPage = () => setPage((prev) => Math.min(totalPages, prev + 1));

  const handleDelete = async (appointmentId: string) => {
    if (!userId) {
      setError("Usuario nao identificado.");
      return;
    }
    const confirmed = window.confirm("Deseja desmarcar este atendimento?");
    if (!confirmed) return;
    setDeletingId(appointmentId);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/appointments/${appointmentId}`, {
        method: "DELETE",
        headers: { "X-User-Id": userId },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Erro ao desmarcar");
      }
      setAppointments((prev) => prev.filter((item) => item.id !== appointmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desmarcar");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusChipStyles = (status: AppointmentStatus) => {
    switch (status) {
      case "Confirmado":
        return {
          backgroundColor: alpha(theme.palette.success.main, 0.12),
          color: theme.palette.success.dark,
          borderColor: alpha(theme.palette.success.main, 0.35),
        };
      case "Em espera":
        return {
          backgroundColor: alpha(theme.palette.info.main, 0.12),
          color: theme.palette.info.dark,
          borderColor: alpha(theme.palette.info.main, 0.35),
        };
      case "Cancelado":
        return {
          backgroundColor: alpha(theme.palette.error.main, 0.12),
          color: theme.palette.error.dark,
          borderColor: alpha(theme.palette.error.main, 0.35),
        };
      case "Recusado":
        return {
          backgroundColor: alpha(theme.palette.error.main, 0.08),
          color: theme.palette.error.dark,
          borderColor: alpha(theme.palette.error.main, 0.25),
        };
      case "Reagendar":
        return {
          backgroundColor: alpha(theme.palette.warning.main, 0.18),
          color: theme.palette.warning.dark,
          borderColor: alpha(theme.palette.warning.main, 0.3),
        };
      default:
        return {
          backgroundColor: alpha(theme.palette.grey[500], 0.12),
          color: theme.palette.text.secondary,
          borderColor: alpha(theme.palette.grey[400], 0.35),
        };
    }
  };

  const hasSelection = Boolean(selectedDate);
  const hasAppointments = paginatedAppointments.length > 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "340px 1fr" },
          gap: 3,
          alignItems: "flex-start",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            backgroundColor: "#ffffff",
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Flatpickr
            value={selectedDate || undefined}
            options={{
              inline: true,
              locale: Portuguese,
              dateFormat: "Y-m-d",
              showMonths: 1,
              clickOpens: false,
              static: true,
              defaultDate: selectedDate || undefined,
              onChange: (_selectedDates: Date[], dateStr: string) =>
                setSelectedDate(dateStr || null),
            }}
            render={({ defaultValue }: { defaultValue?: string }, ref: Ref<HTMLInputElement>) => (
              <input ref={ref} defaultValue={defaultValue} style={{ display: "none" }} />
            )}
          />
        </Paper>
        <Paper
          elevation={2}
          sx={{
            p: 3,
            borderRadius: 3,
            backgroundColor: "#ffffff",
            border: `1px solid ${theme.palette.divider}`,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Box>
              <Typography variant="h6" fontWeight={600} color="primary">
                Atendimentos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Proximos pacientes agendados
              </Typography>
            </Box>
            <IconButton
              color="primary"
              onClick={() => router.push("/dashboard/patients/appointments")}
              sx={{
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.16) },
              }}
            >
              <AddIcon />
            </IconButton>
          </Box>

          <Divider />

          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          {!hasSelection ? (
            <Box
              sx={{
                borderRadius: 2,
                border: `1px dashed ${theme.palette.divider}`,
                p: 3,
                textAlign: "center",
                color: theme.palette.text.secondary,
                backgroundColor: alpha(theme.palette.primary.main, 0.02),
              }}
            >
              Selecione uma data no calendario para ver os atendimentos.
            </Box>
          ) : loading ? (
            <Box
              sx={{
                borderRadius: 2,
                border: `1px dashed ${theme.palette.divider}`,
                p: 3,
                textAlign: "center",
                color: theme.palette.text.secondary,
                backgroundColor: alpha(theme.palette.primary.main, 0.02),
              }}
            >
              Carregando agendamentos...
            </Box>
          ) : !hasAppointments ? (
            <Box
              sx={{
                borderRadius: 2,
                border: `1px dashed ${theme.palette.divider}`,
                p: 3,
                textAlign: "center",
                color: theme.palette.text.secondary,
                backgroundColor: alpha(theme.palette.primary.main, 0.02),
              }}
            >
              Nenhum agendamento encontrado para esta data.
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  overflowX: "auto",
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    minWidth: 720,
                    "& thead th": {
                      textAlign: "left",
                      fontSize: 13,
                      color: theme.palette.text.secondary,
                      padding: "12px",
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      backgroundColor: alpha(theme.palette.grey[100], 0.9),
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    },
                    "& tbody td": {
                      padding: "16px 12px",
                      borderBottom: `1px solid ${theme.palette.divider}`,
                      wordBreak: "break-word",
                      verticalAlign: "middle",
                    },
                    "& tbody tr:hover": {
                      backgroundColor: alpha(theme.palette.primary.main, 0.04),
                    },
                    "& tbody tr:last-of-type td": {
                      borderBottom: "none",
                    },
                  }}
                >
                  <thead>
                    <tr>
                      <th>Horario</th>
                      <th>Paciente</th>
                      <th>Profissional</th>
                      <th>Tipo</th>
                      <th>Situacao</th>
                      <th>Sala</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAppointments.map((appointment) => (
                      <tr key={appointment.id}>
                        <td>
                          {formatTime(appointment.starts_at)} - {formatTime(appointment.ends_at)}
                        </td>
                        <td>{firstName(appointment.patient_name)}</td>
                        <td>{firstName(currentUserName) || "Equipe"}</td>
                        <td>
                          {appointment.type.toLowerCase().startsWith("tele") &&
                          appointment.meeting_url ? (
                            <MuiLink
                              href={appointment.meeting_url}
                              target="_blank"
                              rel="noreferrer"
                              sx={{ fontWeight: 600 }}
                            >
                              {appointment.type}
                            </MuiLink>
                          ) : (
                            appointment.type
                          )}
                        </td>
                        <td>
                          <Box
                            component="span"
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              px: 1.5,
                              py: 0.5,
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: "999px",
                              borderWidth: 1,
                              borderStyle: "solid",
                              textTransform: "capitalize",
                              ...getStatusChipStyles(appointment.status),
                            }}
                          >
                            {appointment.status}
                          </Box>
                        </td>
                        <td>{appointment.room || "Sem sala"}</td>
                        <td>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleDelete(appointment.id)}
                            disabled={deletingId === appointment.id}
                            sx={{ textTransform: "none" }}
                          >
                            {deletingId === appointment.id ? "Removendo..." : "Desmarcar"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  justifyContent: "flex-end",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                  }}
                >
                  Anterior
                </Button>
                <Box
                  sx={{
                    px: 2,
                    py: 0.75,
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    color: theme.palette.text.secondary,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Pagina {currentPage} de {totalPages}
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                  }}
              >
                Proxima
              </Button>
            </Box>
          </>
        )}

      </Paper>
    </Box>

      <style jsx global>{`
        .flatpickr-calendar {
          border-radius: 50px !important;
          border: none !important;
          box-shadow: none !important;
          background-color: #ffffff !important;
        }

        .flatpickr-wrapper,
        .flatpickr-calendar.inline {
          border-radius: 50px !important;
          box-shadow: none !important;
          border: none !important;
          overflow: hidden !important;
        }

        .flatpickr-day.selected,
        .flatpickr-day.selected:hover {
          background: #2563eb !important;
          border-color: #2563eb !important;
          color: #fff !important;
        }
      `}</style>
    </Box>
  );
}
