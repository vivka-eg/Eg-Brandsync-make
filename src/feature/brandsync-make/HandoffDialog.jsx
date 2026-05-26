"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Stack,
  Typography,
  InputBase,
  ButtonBase,
  Avatar,
} from "@mui/material";
import { X, MagnifyingGlass, Ticket, Clock, ArrowRight } from "phosphor-react";

const STATUS_STYLES = {
  "In progress": { fg: "#0073e1", bg: "rgba(0,115,225,0.12)" },
  "In review": { fg: "#b18100", bg: "rgba(177,129,0,0.14)" },
  "Ready for dev": { fg: "#00855b", bg: "rgba(0,133,91,0.14)" },
  Backlog: { fg: "#6d7585", bg: "rgba(109,117,133,0.14)" },
};

const HANDOFFS = [
  {
    ticket: "APT-202",
    title: "Refresh asset filter chips for Catalog",
    lastEditedAt: "2h ago",
    lastEditedBy: "Maya Singh",
    initials: "MS",
    status: "In progress",
  },
  {
    ticket: "APT-189",
    title: "Onboarding wizard – step indicator polish",
    lastEditedAt: "Yesterday",
    lastEditedBy: "Jonas Vinther",
    initials: "JV",
    status: "In review",
  },
  {
    ticket: "BS-148",
    title: "Settings → API tokens table layout",
    lastEditedAt: "2 days ago",
    lastEditedBy: "Priya Rao",
    initials: "PR",
    status: "Ready for dev",
  },
  {
    ticket: "BS-141",
    title: "Empty state for digital assets search",
    lastEditedAt: "3 days ago",
    lastEditedBy: "Alex Chen",
    initials: "AC",
    status: "In progress",
  },
  {
    ticket: "APT-176",
    title: "Brand guideline – typography page redesign",
    lastEditedAt: "5 days ago",
    lastEditedBy: "Maya Singh",
    initials: "MS",
    status: "Backlog",
  },
  {
    ticket: "BS-132",
    title: "Notification feed grouping by date",
    lastEditedAt: "1 week ago",
    lastEditedBy: "Tomás Ribeiro",
    initials: "TR",
    status: "In review",
  },
];

function HandoffRow({ item, onSelect }) {
  const { ticket, title, lastEditedAt, lastEditedBy, initials, status } = item;
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.Backlog;

  return (
    <ButtonBase
      onClick={onSelect}
      sx={{
        width: "100%",
        textAlign: "left",
        bgcolor: "var(--bs-surface-raised)",
        border: "1px solid var(--bs-border-default)",
        borderRadius: "var(--bs-border-radius-150)",
        p: 2,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        transition: "border-color 0.15s, transform 0.15s",
        "&:hover": {
          borderColor: "var(--bs-border-neutral-hover)",
          transform: "translateY(-1px)",
          "& .arrow": { opacity: 1, transform: "translateX(0)" },
        },
        "&:focus-visible": {
          outline: "2px solid var(--bs-border-primary)",
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "var(--bs-border-radius-100)",
          bgcolor: "var(--bs-color-info-container)",
          color: "var(--bs-color-info-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Ticket size={18} weight="regular" />
      </Box>

      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ flexWrap: "wrap" }}>
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{
              color: "var(--bs-color-info-default)",
              letterSpacing: "0.04em",
              fontFamily: "monospace",
            }}
          >
            {ticket}
          </Typography>
          <Box
            sx={{
              px: 0.875,
              py: 0.125,
              fontSize: "10px",
              fontWeight: 600,
              borderRadius: "var(--bs-border-radius-full)",
              bgcolor: statusStyle.bg,
              color: statusStyle.fg,
            }}
          >
            {status}
          </Box>
        </Stack>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{
            color: "var(--bs-text-default)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </Typography>
        <Stack direction="row" alignItems="center" gap={1.25} sx={{ color: "var(--bs-text-muted)" }}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Avatar
              sx={{
                width: 16,
                height: 16,
                fontSize: "9px",
                fontWeight: 700,
                bgcolor: "var(--bs-color-neutral-container)",
                color: "var(--bs-text-default)",
              }}
            >
              {initials}
            </Avatar>
            <Typography variant="caption">{lastEditedBy}</Typography>
          </Stack>
          <Box sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "currentColor", opacity: 0.4 }} />
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Clock size={11} />
            <Typography variant="caption">{lastEditedAt}</Typography>
          </Stack>
        </Stack>
      </Stack>

      <Box
        className="arrow"
        sx={{
          opacity: 0,
          transform: "translateX(-4px)",
          transition: "all 0.15s",
          color: "var(--bs-text-muted)",
          display: "flex",
        }}
      >
        <ArrowRight size={14} weight="bold" />
      </Box>
    </ButtonBase>
  );
}

export default function HandoffDialog({ open, onClose, onSelect }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HANDOFFS;
    return HANDOFFS.filter(
      (h) =>
        h.ticket.toLowerCase().includes(q) ||
        h.title.toLowerCase().includes(q) ||
        h.lastEditedBy.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = (item) => {
    onSelect?.(item);
    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "var(--bs-surface-base)",
            border: "1px solid var(--bs-border-default)",
            borderRadius: "var(--bs-border-radius-200)",
            backgroundImage: "none",
          },
        },
      }}
    >
      <DialogTitle
        component="div"
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          pb: 1.5,
          pr: 1.5,
        }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h6" fontWeight={700} sx={{ color: "var(--bs-text-default)" }}>
            Load handoff
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--bs-text-muted)" }}>
            Pick a Jira ticket to load its handoff into BrandSync Make.
          </Typography>
        </Stack>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            bgcolor: "var(--bs-surface-raised)",
            border: "1px solid var(--bs-border-default)",
            borderRadius: "var(--bs-border-radius-100)",
            px: 1.5,
            py: 1,
            mb: 2.5,
          }}
        >
          <MagnifyingGlass size={16} color="var(--bs-text-muted)" />
          <InputBase
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ticket number, title, or editor"
            sx={{
              color: "var(--bs-text-default)",
              fontSize: "var(--bs-font-size-sm)",
              "& input::placeholder": { color: "var(--bs-text-muted)", opacity: 1 },
            }}
            inputProps={{ "aria-label": "Search handoffs" }}
            autoFocus
          />
        </Box>

        {filtered.length === 0 ? (
          <Typography variant="body2" sx={{ color: "var(--bs-text-muted)", textAlign: "center", py: 4 }}>
            No handoffs match &ldquo;{query}&rdquo;
          </Typography>
        ) : (
          <Stack spacing={1}>
            {filtered.map((item) => (
              <HandoffRow key={item.ticket} item={item} onSelect={() => handleSelect(item)} />
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
