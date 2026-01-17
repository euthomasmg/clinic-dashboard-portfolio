"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";
import { TextField, Button } from "@mui/material";
import AddCircleOutlineRounded from "@mui/icons-material/AddCircleOutlineRounded";
import {
  PeopleRounded,
  EventRounded,
  PendingActionsRounded,
  PsychologyRounded,
  AccessTimeRounded,
  NotificationsRounded,
} from "@mui/icons-material";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type Appointment = {
  id: string;
  patient_name: string;
  starts_at: string;
  type: string;
  meeting_url?: string | null;
  room?: string | null;
  status?: string;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function HomePage() {
  const theme = useTheme();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [patientCount, setPatientCount] = useState(0);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [error, setError] = useState("");

  const [reminders, setReminders] = useState([
    "Atualizar prontuarios dos pacientes de ontem.",
    "Confirmar agendamentos da proxima semana.",
    "Revisar relatorios de estagio.",
  ]);
  const [newReminder, setNewReminder] = useState("");

  useEffect(() => {
    const userId =
      typeof window !== "undefined" ? localStorage.getItem("currentUserId") : null;
    if (!userId) {
      setError("Usuario nao identificado.");
      setLoadingAppointments(false);
      setLoadingWeekly(false);
      setLoadingPatients(false);
      return;
    }
    setLoadingPatients(true);
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const weekStart = startOfWeek.toISOString().slice(0, 10);
    const weekEnd = endOfWeek.toISOString().slice(0, 10);

    const url = `${API_BASE}/appointments?start_date=${today}&end_date=${today}`;
    fetch(url, { headers: { "X-User-Id": userId } })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Erro ao carregar agenda de hoje");
        }
        return res.json() as Promise<Appointment[]>;
      })
      .then((data) => {
        setAppointments(data ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar agenda de hoje");
      })
      .finally(() => setLoadingAppointments(false));

    fetch(`${API_BASE}/appointments?start_date=${weekStart}&end_date=${weekEnd}`, {
      headers: { "X-User-Id": userId },
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Erro ao carregar agenda da semana");
        }
        return res.json() as Promise<Appointment[]>;
      })
      .then((data) => {
        setWeeklyCount((data ?? []).length);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar agenda da semana");
      })
      .finally(() => setLoadingWeekly(false));

    fetch(`${API_BASE}/patients`, { headers: { "X-User-Id": userId } })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Erro ao carregar pacientes");
        }
        return res.json() as Promise<unknown[]>;
      })
      .then((data) => {
        setPatientCount(Array.isArray(data) ? data.length : 0);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar pacientes");
      })
      .finally(() => setLoadingPatients(false));
  }, []);

  const pendingCount = appointments.filter((item) => {
    const s = (item.status || "").toLowerCase();
    return s && s !== "confirmado" && s !== "cancelado";
  }).length;

  const summaryCards = [
    {
      title: "Pacientes ativos",
      value: loadingPatients ? "-" : String(patientCount),
      icon: <PeopleRounded />,
    },
    {
      title: "Atendimentos na semana",
      value: loadingWeekly ? "-" : String(weeklyCount),
      icon: <AccessTimeRounded />,
    },
    {
      title: "Confirmacoes pendentes",
      value: loadingAppointments ? "-" : String(pendingCount),
      icon: <PsychologyRounded />,
    },
  ];

  const handleAddReminder = () => {
    if (newReminder.trim() === "") return;
    setReminders((prev) => [...prev, newReminder.trim()]);
    setNewReminder("");
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
      {summaryCards.map((card) => (
        <Paper
          key={card.title}
          elevation={2}
          sx={{
              flex: "1 1 260px",
              maxWidth: 320,
              p: 2.25,
              borderRadius: 3,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 1.5,
              transition: "0.3s",
              "&:hover": {
                transform: "translateY(-3px)",
                boxShadow: theme.shadows[4],
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: `${theme.palette.primary.main}22`,
                color: theme.palette.primary.main,
              }}
            >
              {card.icon}
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography variant="body2" fontWeight={500} color={theme.palette.text.secondary}>
                {card.title}
              </Typography>
              <Typography variant="h6" fontWeight={700} color={theme.palette.text.primary}>
                {card.value}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      <Paper
        elevation={1}
        sx={{
          p: 3,
          borderRadius: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Agenda de hoje
        </Typography>
        <Divider />
        {error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : loadingAppointments ? (
          <Typography color="text.secondary">Carregando agendamentos...</Typography>
        ) : appointments.length === 0 ? (
          <Typography color="text.secondary">Nenhum atendimento hoje.</Typography>
        ) : (
          appointments.map((item) => (
            <Box
              key={item.id}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 1,
                borderRadius: 2,
                "&:hover": { backgroundColor: `${theme.palette.primary.main}08` },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <AccessTimeRounded sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                <Typography fontWeight={500}>{formatTime(item.starts_at)}</Typography>
              </Box>
              <Typography sx={{ flex: 1, ml: 2 }}>{item.patient_name}</Typography>
              <Typography color={theme.palette.text.secondary}>{item.type}</Typography>
            </Box>
          ))
        )}
      </Paper>

      <Paper
        elevation={1}
        sx={{
          p: 3,
          borderRadius: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          <NotificationsRounded sx={{ mr: 1, verticalAlign: "middle" }} />
          Avisos e lembretes
        </Typography>
        <Divider />
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            handleAddReminder();
          }}
          sx={{ display: "flex", gap: 1 }}
        >
          <TextField
            fullWidth
            size="small"
            label="Novo lembrete"
            value={newReminder}
            onChange={(event) => setNewReminder(event.target.value)}
          />
          <Button type="submit" variant="contained" startIcon={<AddCircleOutlineRounded />}>
            Adicionar
          </Button>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {reminders.map((text, i) => (
            <Paper
              key={i}
              elevation={0}
              sx={{
                p: 1.5,
                pl: 2,
                borderLeft: `4px solid ${theme.palette.primary.main}`,
                backgroundColor: `${theme.palette.primary.main}08`,
              }}
            >
              <Typography variant="body2">{text}</Typography>
            </Paper>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
