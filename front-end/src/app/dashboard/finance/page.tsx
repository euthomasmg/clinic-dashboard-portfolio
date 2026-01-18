"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  IconButton,
  Chip,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
} from "@mui/material";
import {
  AddRounded,
  DeleteRounded,
  AttachMoneyRounded,
  TrendingUpRounded,
  TrendingDownRounded,
  PieChartRounded,
} from "@mui/icons-material";

type CashFlowItem = {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
};

const incomeCategories = ["Consulta", "Supervisão", "Reembolso", "Outros"];
const expenseCategories = ["Operacional", "Infra", "Marketing", "Impostos", "Pessoal", "Variável"];

export default function FinancePage() {
  const [items, setItems] = useState<CashFlowItem[]>([
    { id: "i1", description: "Atendimentos semana", amount: 3200, type: "income", category: "Consulta", date: "2025-11-01" },
    { id: "i2", description: "Supervisão clínica", amount: 1200, type: "income", category: "Supervisão", date: "2025-11-02" },
    { id: "e1", description: "Aluguel sala", amount: 1500, type: "expense", category: "Infra", date: "2025-11-01" },
    { id: "e2", description: "Marketing redes", amount: 450, type: "expense", category: "Marketing", date: "2025-11-03" },
    { id: "e3", description: "Material descartável", amount: 280, type: "expense", category: "Variável", date: "2025-11-02" },
  ]);

  const [incomeForm, setIncomeForm] = useState({ description: "", amount: "", category: incomeCategories[0], date: "" });
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", category: expenseCategories[0], date: "" });

  const [filters, setFilters] = useState({ search: "", category: "todas", type: "todos" });

  const totals = useMemo(() => {
    const incomeTotal = items.filter((i) => i.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expenseTotal = items.filter((i) => i.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    return { incomeTotal, expenseTotal, profit: incomeTotal - expenseTotal };
  }, [items]);

  const addItem = (type: "income" | "expense") => {
    const form = type === "income" ? incomeForm : expenseForm;
    if (!form.description.trim() || Number(form.amount) <= 0 || !form.date) return;

    const newItem: CashFlowItem = {
      id: `${type}-${Date.now()}`,
      description: form.description.trim(),
      amount: Number(form.amount),
      type,
      category: form.category,
      date: form.date,
    };
    setItems((prev) => [newItem, ...prev]);
    if (type === "income") {
      setIncomeForm({ description: "", amount: "", category: incomeCategories[0], date: "" });
    } else {
      setExpenseForm({ description: "", amount: "", category: expenseCategories[0], date: "" });
    }
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const summaryCards = [
    {
      title: "Receitas",
      value: totals.incomeTotal,
      icon: <TrendingUpRounded />,
      color: "#0b2d5c",
    },
    {
      title: "Despesas",
      value: totals.expenseTotal,
      icon: <TrendingDownRounded />,
      color: "#b42318",
    },
    {
      title: "Lucro/Saldo",
      value: totals.profit,
      icon: <AttachMoneyRounded />,
      color: totals.profit >= 0 ? "#2563eb" : "#b42318",
    },
  ];

  const renderForm = (
    type: "income" | "expense",
    title: string,
    placeholder: string,
    categories: string[],
    form: { description: string; amount: string; category: string; date: string },
    setForm: (value: { description: string; amount: string; category: string; date: string }) => void
  ) => (
    <Paper
      elevation={0}
      sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: 2, display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 1.5 }}>
        <TextField
          label="Descrição"
          fullWidth
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder={placeholder}
        />
        <TextField
          label="Valor"
          type="number"
          inputProps={{ min: 0, step: "0.01" }}
          sx={{ width: { xs: "100%", md: 160 } }}
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <TextField
          label="Data"
          type="date"
          InputLabelProps={{ shrink: true }}
          sx={{ width: { xs: "100%", md: 170 } }}
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <TextField
          select
          label="Categoria"
          sx={{ width: { xs: "100%", md: 180 } }}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {categories.map((cat) => (
            <MenuItem key={cat} value={cat}>
              {cat}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => addItem(type)}
          sx={{ minWidth: 140, height: 56 }}
        >
          Adicionar
        </Button>
      </Box>
    </Paper>
  );

  const renderTable = () => (
    <Paper elevation={0} sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: 2 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 1,
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Lançamentos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Filtros rápidos para localizar receitas e despesas
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <TextField
            size="small"
            label="Buscar"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            sx={{ minWidth: 180 }}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            sx={{ minWidth: 140 }}
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value as "todos" | "income" | "expense" })}
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="income">Entradas</MenuItem>
            <MenuItem value="expense">Saídas</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Categoria"
            sx={{ minWidth: 160 }}
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <MenuItem value="todas">Todas</MenuItem>
            {[...incomeCategories, ...expenseCategories].map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Valor (R$)</TableCell>
              <TableCell align="center">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    Nenhum lançamento.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {tableRows.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>{new Date(item.date).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>
                  <Typography fontWeight={600}>{item.description}</Typography>
                </TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={item.type === "income" ? "Entrada" : "Saída"}
                    color={item.type === "income" ? "success" : "error"}
                  />
                </TableCell>
                <TableCell align="right" style={{ color: item.type === "income" ? "#2563eb" : "#b42318", fontWeight: 700 }}>
                  {item.amount.toFixed(2)}
                </TableCell>
                <TableCell align="center">
                  <IconButton color="error" onClick={() => removeItem(item.id)}>
                    <DeleteRounded />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchType = filters.type === "todos" ? true : item.type === filters.type;
      const matchCategory = filters.category === "todas" ? true : item.category === filters.category;
      const matchSearch =
        filters.search.trim() === ""
          ? true
          : item.description.toLowerCase().includes(filters.search.toLowerCase());
      return matchType && matchCategory && matchSearch;
    });
  }, [items, filters]);

  const tableRows = filteredItems;

  const renderForms = () => (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: "1px solid #e5e7eb",
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Typography variant="subtitle1" fontWeight={700}>
        Lançar movimentações
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Box>
          {renderForm("income", "Adicionar receita", "Ex.: Consulta particular", incomeCategories, incomeForm, setIncomeForm)}
        </Box>
        <Box>
          {renderForm("expense", "Adicionar despesa", "Ex.: Assinatura de software", expenseCategories, expenseForm, setExpenseForm)}
        </Box>
      </Box>
    </Paper>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      </Box>

      {/* Resumo */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
        {summaryCards.map((card) => (
          <Paper
            key={card.title}
            elevation={0}
            sx={{
              p: 2,
              border: "1px solid #e5e7eb",
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {card.title}
              </Typography>
              <Typography variant="h6" fontWeight={800}>
                R$ {card.value.toFixed(2)}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: `${card.color}11`,
                color: card.color,
                display: "grid",
                placeItems: "center",
              }}
            >
              {card.icon}
            </Box>
          </Paper>
        ))}
      </Box>

      {renderForms()}

      {/* Tabela de lançamentos */}
      {renderTable()}
    </Box>
  );
}
