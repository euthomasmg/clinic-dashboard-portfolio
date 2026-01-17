"use client";

import {
  AppBar,
  Avatar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  ButtonBase,
  useTheme,
} from "@mui/material";
import {
  Menu as MenuIcon,
  HomeRounded,
  EventRounded,
  PeopleRounded,
  SchoolRounded,
  AttachMoneyRounded,
  SettingsRounded,
  LogoutRounded,
} from "@mui/icons-material";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { mockUserProfile } from "./profile/userData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

type UserApiResponse = {
  full_name?: string;
  username?: string;
  account_type?: string;
};

const drawerWidth = 260;
const FINANCE_PATH = "/dashboard/finance";
const FINANCE_ALLOWED_MENU_PATHS = new Set(["/dashboard/home", FINANCE_PATH]);
const FINANCE_BLOCKED_PREFIXES = ["/dashboard/schedule", "/dashboard/patients"];
const FINANCE_REDIRECT_PATH = FINANCE_PATH;
const PROFESSIONAL_BLOCKED_PREFIXES = [FINANCE_PATH];
const PROFESSIONAL_REDIRECT_PATH = "/dashboard/home";
const INTERN_BLOCKED_PREFIXES = [FINANCE_PATH];
const INTERN_REDIRECT_PATH = "/dashboard/home";

// Menu lateral dividido em secoes
const menuSections = [
  {
    title: "Principal",
    items: [
      { text: "Inicio", icon: <HomeRounded />, path: "/dashboard/home" },
      { text: "Agenda", icon: <EventRounded />, path: "/dashboard/schedule" },
      { text: "Pacientes", icon: <PeopleRounded />, path: "/dashboard/patients" },
    ],
  },
  // {
  //   title: "Equipe",
  //   items: [
  //     { text: "Profissionais", icon: <PeopleRounded />, path: "/dashboard/professionals" },
  //     { text: "Estagiarios", icon: <SchoolRounded />, path: "/dashboard/interns" },
  //   ],
  // },
  {
    title: "Financeiro",
    items: [
      { text: "Contas", icon: <AttachMoneyRounded />, path: "/dashboard/finance" },
      // { text: "Relatorios", icon: <SettingsRounded />, path: "/dashboard/reports" },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(mockUserProfile);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedName = window.localStorage.getItem("currentUserName");
    const storedUsername = window.localStorage.getItem("currentUsername");
    const storedRole = window.localStorage.getItem("currentUserRole");
    if (storedName || storedUsername || storedRole) {
      setUser((prev) => ({
        ...prev,
        ...(storedName ? { name: storedName } : {}),
        ...(storedUsername ? { username: storedUsername } : {}),
        ...(storedRole ? { role: storedRole } : {}),
      }));
    }
    const storedUserId = window.localStorage.getItem("currentUserId");
    if (!storedUserId) return;
    async function loadUserFromApi(userId: string) {
      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          headers: { "X-User-Id": userId },
        });
        if (!res.ok) return;
        const payload: UserApiResponse = await res.json();
        setUser((prev) => ({
          ...prev,
          ...(payload.full_name ? { name: payload.full_name } : {}),
          ...(payload.username ? { username: payload.username } : {}),
          ...(payload.account_type ? { role: payload.account_type } : {}),
        }));
        if (payload.full_name) window.localStorage.setItem("currentUserName", payload.full_name);
        if (payload.username) window.localStorage.setItem("currentUsername", payload.username);
        if (payload.account_type) window.localStorage.setItem("currentUserRole", payload.account_type);
      } catch {
        // silencia erro para nao travar o layout
      }
    }
    loadUserFromApi(storedUserId);
  }, []);

  const userInitials = (user.name || user.username || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleLogout = () => {
    document.cookie = "token=; Max-Age=0; path=/;";
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("currentUserId");
      window.localStorage.removeItem("currentUserName");
      window.localStorage.removeItem("currentUsername");
      window.localStorage.removeItem("currentUserRole");
      window.sessionStorage.removeItem("pendingSensitiveChanges");
    }
    router.push("/auth/login");
  };

  // Titulos basicos por rota
  const pageTitles: Record<string, string> = {
    "/dashboard/home": "Inicio",
    "/dashboard/schedule": "Agenda",
    "/dashboard/patients": "Pacientes",
    "/dashboard/professionals": "Profissionais",
    "/dashboard/interns": "Estagiarios",
    "/dashboard/finance": "Financeiro",
    "/dashboard/reports": "Relatorios",
    "/dashboard/profile": "Perfil",
  };
  const currentTitle = pageTitles[pathname] || "Painel da Clinica";
  const isFinanceRole = (user.role || "").toLowerCase() === "financeiro";
  const isProfessionalRole = (user.role || "").toLowerCase() === "profissional";
  const isInternRole = (user.role || "").toLowerCase() === "estagiario";
  const shouldShowMenuItem = (path: string) => {
    if (isFinanceRole) return FINANCE_ALLOWED_MENU_PATHS.has(path);
    if (isProfessionalRole || isInternRole) {
      const blockedList = isProfessionalRole ? PROFESSIONAL_BLOCKED_PREFIXES : INTERN_BLOCKED_PREFIXES;
      return !blockedList.some((blockedPath) => path.startsWith(blockedPath));
    }
    return true;
  };
  const filteredMenuSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => shouldShowMenuItem(item.path)),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    if (isFinanceRole) {
      const isBlocked = FINANCE_BLOCKED_PREFIXES.some((blockedPath) => pathname.startsWith(blockedPath));
      if (isBlocked) {
        router.replace(FINANCE_REDIRECT_PATH);
      }
      return;
    }
    if (isProfessionalRole || isInternRole) {
      const blockedList = isProfessionalRole ? PROFESSIONAL_BLOCKED_PREFIXES : INTERN_BLOCKED_PREFIXES;
      const redirectPath = isProfessionalRole ? PROFESSIONAL_REDIRECT_PATH : INTERN_REDIRECT_PATH;
      const isBlockedFinance = blockedList.some((blockedPath) => pathname.startsWith(blockedPath));
      if (isBlockedFinance) {
        router.replace(redirectPath);
      }
    }
  }, [isFinanceRole, isProfessionalRole, isInternRole, pathname, router]);

  // Drawer lateral
  const drawer = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        p: 2,
        bgcolor: "#fff",
      }}
    >
      {/* Cabecalho */}
      <Box>
        <Typography
          variant="h6"
          sx={{
            textAlign: "center",
            fontWeight: 700,
            mb: 3,
            color: theme.palette.primary.main,
            letterSpacing: "-0.5px",
          }}
        >
          Clinica Compassivamente
        </Typography>

        {/* Secoes de menu */}
        {filteredMenuSections.map((section) => (
          <Box key={section.title} sx={{ mb: 2 }}>
            <Typography
              variant="overline"
              sx={{
                color: theme.palette.text.secondary,
                fontWeight: 600,
                pl: 2,
              }}
            >
              {section.title}
            </Typography>

            <List sx={{ py: 0 }}>
              {section.items.map((item) => {
                const active = pathname === item.path;
                return (
                  <ListItemButton
                    key={item.text}
                    onClick={() => router.push(item.path)}
                    sx={{
                      borderRadius: 2,
                      mt: 0.5,
                      py: 1,
                      px: 2,
                      backgroundColor: active
                        ? theme.palette.action.selected
                        : "transparent",
                      "&:hover": {
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: active
                          ? theme.palette.primary.main
                          : theme.palette.text.secondary,
                        minWidth: 36,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: active ? 600 : 500,
                        color: active
                          ? theme.palette.primary.main
                          : theme.palette.text.primary,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Botao de sair */}
      <Box>
        <Divider sx={{ mb: 2 }} />
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            px: 2,
            py: 1.2,
            color: theme.palette.error.main,
            "&:hover": {
              backgroundColor: "rgba(211,47,47,0.08)",
            },
          }}
        >
          <ListItemIcon sx={{ color: theme.palette.error.main }}>
            <LogoutRounded />
          </ListItemIcon>
          <ListItemText
            primary="Sair"
            primaryTypographyProps={{ fontWeight: 500 }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", bgcolor: theme.palette.background.default }}>
      <CssBaseline />

      {/* Topbar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: "#fff",
          color: theme.palette.text.primary,
          borderBottom: "1px solid #e0e0e0",
          height: 64,
          display: "flex",
          justifyContent: "center",
          borderRadius: 0,
        }}
      >
        <Toolbar
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              edge="start"
              color="inherit"
              onClick={handleDrawerToggle}
              sx={{ display: { sm: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="h6"
              fontWeight={600}
              color={theme.palette.primary.main}
            >
              {currentTitle}
            </Typography>
          </Box>

          <ButtonBase
            onClick={() => router.push("/dashboard/profile")}
            aria-label={`Abrir perfil de ${user.name}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 1.2,
              py: 0.75,
              borderRadius: 999,
              transition: "0.2s ease",
              "&:hover": { backgroundColor: theme.palette.action.hover },
            }}
          >
            <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
              <Typography variant="body2" fontWeight={600}>
                {user.name}
              </Typography>
              <Typography variant="caption" color={theme.palette.text.secondary}>
                Ver perfil
              </Typography>
            </Box>
            <Avatar
              sx={{
                bgcolor: theme.palette.primary.main,
                color: "#fff",
                width: 40,
                height: 40,
                fontWeight: 700,
              }}
            >
              {userInitials}
            </Avatar>
          </ButtonBase>
        </Toolbar>
      </AppBar>

      {/* Drawer Desktop */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "none",
            borderRadius: 0,
          },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Drawer Mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRadius: 0,
            boxShadow: "none",
            borderRight: "none",
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Conteudo */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 4 },
          mt: 8,
          minHeight: "calc(100vh - 64px)",
          bgcolor: theme.palette.background.default,
          transition: "0.2s ease",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
