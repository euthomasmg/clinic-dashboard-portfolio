"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#0b2d5c", // azul escuro
    },
    secondary: {
      main: "#e6c767", // dourado ainda disponível p/ botões/links
    },
    success: {
      main: "#1c4aa3",
      dark: "#0b2d5c",
      light: "#60a5fa",
      contrastText: "#ffffff",
    },
    background: {
      default: "transparent",
    },
    text: {
      primary: "#1a1a1a",
      secondary: "#4f4f4f",
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          background:
            "linear-gradient(135deg, #0b2d5c, #2563eb)",
          // verde escuro → verde claro suave
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
  },
});

export default theme;
