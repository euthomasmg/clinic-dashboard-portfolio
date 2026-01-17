"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import SpeedDial from "@mui/material/SpeedDial";
import PersonAddAltRounded from "@mui/icons-material/PersonAddAltRounded";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type Patient = {
  id: string;
  full_name: string;
};

export default function PatientsPage() {
  const theme = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPatients() {
      const userId =
        typeof window !== "undefined" ? localStorage.getItem("currentUserId") : null;
      if (!userId) {
        setError("Usuario nao identificado.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/patients`, {
          headers: { "X-User-Id": userId },
        });
        if (!res.ok) {
          throw new Error("Falha ao carregar pacientes");
        }
        const data = await res.json();
        setPatients(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar pacientes");
      } finally {
        setLoading(false);
      }
    }
    loadPatients();
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Paper
        elevation={1}
        sx={{
          p: 3,
          borderRadius: 3,
          minHeight: "80vh",
          backgroundColor: theme.palette.background.paper,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        {loading ? (
          <Typography variant="body1">Carregando pacientes...</Typography>
        ) : patients.length === 0 ? (
          <Typography variant="body1" color="text.secondary">
            Nenhum paciente cadastrado ainda.
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 2,
            }}
          >
            {patients.map((patient) => (
              <Paper
                key={patient.id}
                elevation={1}
                sx={{
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  borderRadius: 3,
                  cursor: "pointer",
                  transition: "0.3s",
                  "&:hover": {
                    transform: "translateY(-3px)",
                    boxShadow: theme.shadows[3],
                  },
                }}
                onClick={() =>
                  router.push(
                    `/dashboard/patients/id?patientId=${encodeURIComponent(patient.id)}`
                  )
                }
              >
                <Avatar
                  sx={{
                    bgcolor: `${theme.palette.primary.main}22`,
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                  }}
                >
                  {patient.full_name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography fontWeight={600}>{patient.full_name}</Typography>
                  <Typography variant="body2" color={theme.palette.text.secondary}></Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        )}

        <SpeedDial
          ariaLabel="Criar novo cadastro"
          sx={{
            position: "absolute",
            bottom: 24,
            right: 24,
            "& .MuiSpeedDialAction-fab": {
              width: 56,
              height: 56,
              boxShadow: theme.shadows[3],
              "& svg": { fontSize: 28 },
            },
          }}
          icon={<AddIcon />}
          onClick={() => router.push("/dashboard/patients/new")}
          FabProps={{
            color: "primary",
            sx: { width: 56, height: 56, boxShadow: theme.shadows[4] },
          }}
        />
      </Paper>
    </Box>
  );
}
