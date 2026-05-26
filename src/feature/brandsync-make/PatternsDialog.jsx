"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Stack,
  Typography,
  ButtonBase,
  Button,
} from "@mui/material";
import {
  X,
  Plus,
  Sparkle,
  SquaresFour,
  TextAa,
  Cards,
  ListBullets,
  Table,
  Browser,
  ChartLine,
  ArrowSquareOut,
} from "phosphor-react";

const SECTIONS = [
  { id: "explore", name: "Explore", icon: Sparkle },
  { id: "dashboard", name: "Dashboard", icon: SquaresFour, accent: "#0073e1" },
  { id: "form", name: "Form", icon: TextAa, accent: "#715afc" },
  { id: "cards", name: "Cards", icon: Cards, accent: "#00855b" },
  { id: "navigation", name: "Navigation", icon: ListBullets, accent: "#b18100" },
  { id: "tables", name: "Tables", icon: Table, accent: "#d93539" },
  { id: "modals", name: "Modals", icon: Browser, accent: "#3779ae" },
  { id: "graphs", name: "Graphs", icon: ChartLine, accent: "#d12e75" },
];

const PATTERNS = {
  dashboard: {
    source: "From EG BrandSync",
    items: [
      { id: "tabular-dashboard", name: "Tabular Dashboard", subtitle: "Table-first dashboard with filters" },
      { id: "analytical-dashboard", name: "Analytical Dashboard", subtitle: "Stat cards, charts, breakdowns" },
      { id: "grid-based-dashboard", name: "Grid Based Dashboard", subtitle: "Card grid with KPIs" },
    ],
  },
  form: {
    source: "From EG BrandSync",
    items: [
      { id: "login-form", name: "Login Form", subtitle: "Email + password, SSO option" },
      { id: "registration-form", name: "Registration Form", subtitle: "Sign-up with validation" },
      { id: "contact-form", name: "Contact Form", subtitle: "Name, email, message" },
      { id: "multi-step-form", name: "Multi Step Form", subtitle: "Stepper-driven wizard" },
      { id: "search-form", name: "Search Form", subtitle: "Search with filter chips" },
    ],
  },
  cards: {
    source: "From EG BrandSync",
    items: [
      { id: "product-card", name: "Product Card", subtitle: "Image, title, price, CTA" },
      { id: "profile-card", name: "Profile Card", subtitle: "Avatar, role, actions" },
      { id: "stats-card", name: "Stats Card", subtitle: "Single KPI with delta" },
      { id: "info-card", name: "Info Card", subtitle: "Icon, headline, body" },
    ],
  },
  navigation: {
    source: "From EG BrandSync",
    items: [
      { id: "top-nav", name: "Top Navigation", subtitle: "Logo, links, profile menu" },
      { id: "sidebar-nav", name: "Sidebar Navigation", subtitle: "Collapsible app shell sidebar" },
      { id: "breadcrumb", name: "Breadcrumb", subtitle: "Path with truncation" },
      { id: "tabs", name: "Tabs", subtitle: "Horizontal section switcher" },
    ],
  },
  tables: {
    source: "From EG BrandSync",
    items: [
      { id: "data-table", name: "Data Table", subtitle: "Sortable rows with badges" },
      { id: "sortable-table", name: "Sortable Table", subtitle: "Column sort indicators" },
      { id: "editable-table", name: "Editable Table", subtitle: "Inline cell editing" },
    ],
  },
  modals: {
    source: "From EG BrandSync",
    items: [
      { id: "confirmation-modal", name: "Confirmation Modal", subtitle: "Destructive action confirm" },
      { id: "form-modal", name: "Form Modal", subtitle: "Inline form in a dialog" },
      { id: "info-modal", name: "Info Modal", subtitle: "Read-only details view" },
    ],
  },
  graphs: {
    source: "From EG BrandSync",
    items: [
      { id: "bar-chart", name: "Bar Chart", subtitle: "Categorical comparison" },
      { id: "line-chart", name: "Line Chart", subtitle: "Trend over time" },
      { id: "pie-chart", name: "Pie Chart", subtitle: "Part-to-whole breakdown" },
      { id: "area-chart", name: "Area Chart", subtitle: "Stacked volume over time" },
    ],
  },
};

const EXPLORE_FEATURED = [
  { categoryId: "dashboard", patternId: "analytical-dashboard" },
  { categoryId: "form", patternId: "multi-step-form" },
  { categoryId: "tables", patternId: "data-table" },
  { categoryId: "graphs", patternId: "line-chart" },
];

function PatternPreview({ accent, kind }) {
  if (kind === "dashboard") {
    return (
      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1, height: "100%" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                height: 28,
                bgcolor: "var(--bs-surface-container)",
                borderRadius: "var(--bs-border-radius-50)",
                border: "1px solid var(--bs-border-default)",
              }}
            />
          ))}
        </Box>
        <Box
          sx={{
            flex: 1,
            bgcolor: "var(--bs-surface-container)",
            borderRadius: "var(--bs-border-radius-50)",
            border: "1px solid var(--bs-border-default)",
            backgroundImage: `linear-gradient(180deg, transparent 60%, ${accent}33 100%)`,
          }}
        />
      </Box>
    );
  }
  if (kind === "form") {
    return (
      <Stack spacing={0.875} sx={{ p: 1.5, height: "100%", justifyContent: "center" }}>
        {[0, 1, 2].map((i) => (
          <Stack key={i} spacing={0.5}>
            <Box sx={{ height: 3, width: 30, bgcolor: "var(--bs-text-muted)", opacity: 0.4, borderRadius: 3 }} />
            <Box
              sx={{
                height: 16,
                bgcolor: "var(--bs-surface-container)",
                border: "1px solid var(--bs-border-default)",
                borderRadius: "var(--bs-border-radius-50)",
              }}
            />
          </Stack>
        ))}
        <Box
          sx={{
            mt: 0.5,
            height: 18,
            width: "40%",
            bgcolor: accent,
            borderRadius: "var(--bs-border-radius-50)",
          }}
        />
      </Stack>
    );
  }
  if (kind === "cards") {
    return (
      <Box sx={{ p: 1.5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75, height: "100%" }}>
        {[0, 1, 2, 3].map((i) => (
          <Stack
            key={i}
            spacing={0.5}
            sx={{
              bgcolor: "var(--bs-surface-container)",
              border: "1px solid var(--bs-border-default)",
              borderRadius: "var(--bs-border-radius-50)",
              p: 0.75,
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: accent }} />
            <Box sx={{ height: 3, bgcolor: "var(--bs-text-muted)", opacity: 0.4, borderRadius: 3 }} />
            <Box sx={{ height: 3, width: "60%", bgcolor: "var(--bs-text-muted)", opacity: 0.3, borderRadius: 3 }} />
          </Stack>
        ))}
      </Box>
    );
  }
  if (kind === "navigation") {
    return (
      <Stack sx={{ height: "100%" }}>
        <Stack
          direction="row"
          alignItems="center"
          gap={1}
          sx={{
            height: 26,
            px: 1.25,
            borderBottom: "1px solid var(--bs-border-default)",
            bgcolor: "var(--bs-surface-container)",
          }}
        >
          <Box sx={{ width: 14, height: 6, bgcolor: accent, borderRadius: 1 }} />
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} sx={{ flex: 1, height: 4, bgcolor: "var(--bs-text-muted)", opacity: 0.3, borderRadius: 3 }} />
          ))}
        </Stack>
        <Box sx={{ flex: 1, bgcolor: "var(--bs-surface-base)" }} />
      </Stack>
    );
  }
  if (kind === "tables") {
    return (
      <Stack sx={{ p: 1.25, height: "100%", gap: 0.5 }}>
        <Stack
          direction="row"
          gap={0.75}
          sx={{
            pb: 0.5,
            borderBottom: "1px solid var(--bs-border-default)",
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} sx={{ flex: 1, height: 4, bgcolor: accent, opacity: 0.5, borderRadius: 3 }} />
          ))}
        </Stack>
        {[0, 1, 2, 3].map((row) => (
          <Stack key={row} direction="row" gap={0.75} sx={{ py: 0.4 }}>
            {[0, 1, 2, 3].map((c) => (
              <Box key={c} sx={{ flex: 1, height: 3, bgcolor: "var(--bs-text-muted)", opacity: 0.35, borderRadius: 3 }} />
            ))}
          </Stack>
        ))}
      </Stack>
    );
  }
  if (kind === "modals") {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "var(--bs-surface-overlay)",
          p: 1.5,
        }}
      >
        <Stack
          spacing={0.75}
          sx={{
            width: "85%",
            p: 1.25,
            bgcolor: "var(--bs-surface-base)",
            border: "1px solid var(--bs-border-default)",
            borderRadius: "var(--bs-border-radius-100)",
            boxShadow: "var(--bs-shadow-md)",
          }}
        >
          <Box sx={{ height: 5, width: "50%", bgcolor: "var(--bs-text-default)", opacity: 0.7, borderRadius: 3 }} />
          <Box sx={{ height: 3, bgcolor: "var(--bs-text-muted)", opacity: 0.4, borderRadius: 3 }} />
          <Box sx={{ height: 3, width: "70%", bgcolor: "var(--bs-text-muted)", opacity: 0.4, borderRadius: 3 }} />
          <Stack direction="row" gap={0.5} justifyContent="flex-end" sx={{ mt: 0.5 }}>
            <Box sx={{ height: 12, width: 28, bgcolor: "var(--bs-surface-container)", borderRadius: 3 }} />
            <Box sx={{ height: 12, width: 28, bgcolor: accent, borderRadius: 3 }} />
          </Stack>
        </Stack>
      </Box>
    );
  }
  if (kind === "graphs") {
    return (
      <Box
        sx={{
          p: 1.5,
          height: "100%",
          position: "relative",
          backgroundImage: `linear-gradient(180deg, transparent 0%, ${accent}33 100%)`,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 12,
            borderBottom: "1px solid var(--bs-border-default)",
            borderLeft: "1px solid var(--bs-border-default)",
          }}
        />
        <Box
          component="svg"
          viewBox="0 0 100 50"
          preserveAspectRatio="none"
          sx={{ position: "absolute", inset: 12, width: "calc(100% - 24px)", height: "calc(100% - 24px)" }}
        >
          <polyline
            fill="none"
            stroke={accent}
            strokeWidth="1.5"
            strokeLinecap="round"
            points="0,40 15,30 30,34 45,18 60,22 75,10 90,14 100,6"
          />
        </Box>
      </Box>
    );
  }
  return null;
}

function PatternCard({ pattern, accent, kind, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        textAlign: "left",
        bgcolor: "var(--bs-surface-raised)",
        border: "1px solid var(--bs-border-default)",
        borderRadius: "var(--bs-border-radius-150)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        transition: "border-color 0.15s, transform 0.15s",
        "&:hover": {
          borderColor: accent,
          transform: "translateY(-2px)",
        },
        "&:focus-visible": {
          outline: "2px solid var(--bs-border-primary)",
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          aspectRatio: "16 / 9",
          bgcolor: "var(--bs-surface-base)",
          borderBottom: "1px solid var(--bs-border-default)",
        }}
      >
        <PatternPreview accent={accent} kind={kind} />
      </Box>
      <Stack spacing={0.25} sx={{ p: 1.5 }}>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ color: "var(--bs-text-default)" }}
        >
          {pattern.name}
        </Typography>
        <Typography variant="caption" sx={{ color: "var(--bs-text-muted)" }}>
          {pattern.subtitle}
        </Typography>
      </Stack>
    </ButtonBase>
  );
}

function SidebarItem({ section, active, onClick }) {
  const { name, icon: Icon } = section;
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        justifyContent: "flex-start",
        gap: 1.25,
        px: 1.75,
        py: 1.25,
        borderRadius: "var(--bs-border-radius-100)",
        bgcolor: active ? "var(--bs-color-accent-default)" : "transparent",
        color: active ? "var(--bs-text-inverse)" : "var(--bs-text-default)",
        fontWeight: active ? 600 : 500,
        transition: "background 0.15s, color 0.15s",
        "&:hover": {
          bgcolor: active ? "var(--bs-color-accent-default)" : "var(--bs-surface-hover)",
        },
      }}
    >
      <Icon size={16} weight={active ? "fill" : "regular"} />
      <Typography variant="body2" fontWeight="inherit" sx={{ color: "inherit" }}>
        {name}
      </Typography>
    </ButtonBase>
  );
}

export default function PatternsDialog({ open, onClose }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState("explore");

  const activeSection = SECTIONS.find((s) => s.id === activeId);

  const contentItems = useMemo(() => {
    if (activeId === "explore") {
      return EXPLORE_FEATURED.map(({ categoryId, patternId }) => {
        const section = SECTIONS.find((s) => s.id === categoryId);
        const pattern = PATTERNS[categoryId].items.find((p) => p.id === patternId);
        return { categoryId, accent: section.accent, kind: categoryId, pattern };
      });
    }
    return PATTERNS[activeId].items.map((p) => ({
      categoryId: activeId,
      accent: activeSection.accent,
      kind: activeId,
      pattern: p,
    }));
  }, [activeId, activeSection]);

  const sourceLabel =
    activeId === "explore"
      ? "Featured patterns"
      : PATTERNS[activeId]?.source || "From EG BrandSync";

  const handleSelect = (categoryId, patternId) => {
    onClose?.();
    router.push(`/mcp/patterns/${categoryId}?pattern=${patternId}`);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "var(--bs-surface-base)",
            border: "1px solid var(--bs-border-default)",
            borderRadius: "var(--bs-border-radius-200)",
            backgroundImage: "none",
            height: "82vh",
            maxHeight: 760,
          },
        },
      }}
    >
      <DialogTitle
        component="div"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          py: 2,
          px: 3,
          borderBottom: "1px solid var(--bs-border-default)",
        }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ color: "var(--bs-text-default)" }}>
          Start from BrandSync patterns
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "240px 1fr" },
          overflow: "hidden",
        }}
      >
        {/* Sidebar */}
        <Stack
          spacing={0.5}
          sx={{
            p: 1.5,
            borderRight: { xs: "none", md: "1px solid var(--bs-border-default)" },
            borderBottom: { xs: "1px solid var(--bs-border-default)", md: "none" },
            overflowY: "auto",
            minHeight: 0,
            bgcolor: "var(--bs-surface-base)",
          }}
        >
          {SECTIONS.map((s) => (
            <SidebarItem
              key={s.id}
              section={s}
              active={activeId === s.id}
              onClick={() => setActiveId(s.id)}
            />
          ))}
          <Box sx={{ flex: 1 }} />
          <Button
            startIcon={<ArrowSquareOut size={14} />}
            onClick={() => {
              onClose?.();
              router.push("/mcp/patterns");
            }}
            sx={{
              justifyContent: "flex-start",
              color: "var(--bs-color-accent-default)",
              textTransform: "none",
              fontWeight: 500,
              px: 1.75,
              py: 1.25,
              "&:hover": { bgcolor: "var(--bs-surface-hover)" },
            }}
          >
            See more in MCP
          </Button>
        </Stack>

        {/* Content */}
        <Box sx={{ overflowY: "auto", p: 3, minHeight: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
            <Stack direction="row" alignItems="center" gap={1.25}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  bgcolor: activeSection.accent
                    ? `${activeSection.accent}33`
                    : "var(--bs-color-accent-container)",
                  color: activeSection.accent || "var(--bs-color-accent-default)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "var(--bs-font-size-sm)",
                }}
              >
                {activeSection.name.charAt(0)}
              </Box>
              <Typography variant="body1" fontWeight={600} sx={{ color: "var(--bs-text-default)" }}>
                {sourceLabel}
              </Typography>
            </Stack>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Plus size={14} weight="bold" />}
              sx={{
                textTransform: "none",
                borderColor: "var(--bs-border-default)",
                color: "var(--bs-text-default)",
                "&:hover": {
                  borderColor: "var(--bs-border-neutral-hover)",
                  bgcolor: "var(--bs-surface-hover)",
                },
              }}
            >
              New pattern
            </Button>
          </Stack>

          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ color: "var(--bs-text-default)", mb: 1.5 }}
          >
            {activeSection.name}
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
              gap: 2,
            }}
          >
            {contentItems.map(({ categoryId, accent, kind, pattern }) => (
              <PatternCard
                key={`${categoryId}-${pattern.id}`}
                pattern={pattern}
                accent={accent}
                kind={kind}
                onClick={() => handleSelect(categoryId, pattern.id)}
              />
            ))}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
