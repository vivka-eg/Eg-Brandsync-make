"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Stack,
  Typography,
  Button,
  ButtonBase,
  InputBase,
  CircularProgress,
} from "@mui/material";
import { X, Plus, FolderOpen, FileText, ArrowRight, FolderPlus } from "phosphor-react";

// LOCAL DEV ONLY — same hardcoded user as /brandsync-make/my-patterns/page.js.
// When real auth lands, both files should switch in lockstep.
const USER_EMAIL = "vivka@eg.dk";

function formatRelative(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ProjectRow({ project, onOpen }) {
  return (
    <ButtonBase
      onClick={() => onOpen(project)}
      sx={{
        width: "100%",
        textAlign: "left",
        bgcolor: "var(--bs-surface-raised)",
        border: "1px solid var(--bs-border-default)",
        borderRadius: "var(--bs-border-radius-150)",
        p: 2,
        display: "flex",
        alignItems: "center",
        gap: 2,
        transition: "border-color 0.15s, transform 0.15s",
        "&:hover": {
          borderColor: "var(--bs-border-neutral-hover)",
          transform: "translateY(-1px)",
        },
        "&:focus-visible": {
          outline: "2px solid var(--bs-border-primary)",
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: "var(--bs-border-radius-100)",
          bgcolor: "var(--bs-color-accent-container)",
          color: "var(--bs-color-accent-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <FolderOpen size={20} weight="fill" />
      </Box>
      <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
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
          {project.name}
        </Typography>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <FileText size={12} color="var(--bs-text-muted)" />
            <Typography variant="caption" sx={{ color: "var(--bs-text-muted)" }}>
              {project.file_count} {project.file_count === 1 ? "file" : "files"}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: "var(--bs-text-muted)" }}>
            · Updated {formatRelative(project.updated_at)}
          </Typography>
        </Stack>
      </Stack>
      <ArrowRight size={16} color="var(--bs-text-muted)" />
    </ButtonBase>
  );
}

function EmptyState({ onCreate }) {
  return (
    <Stack
      alignItems="center"
      spacing={2}
      sx={{
        py: 6,
        px: 3,
        textAlign: "center",
        border: "1px dashed var(--bs-border-default)",
        borderRadius: "var(--bs-border-radius-150)",
        bgcolor: "var(--bs-surface-raised)",
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          bgcolor: "var(--bs-color-accent-container)",
          color: "var(--bs-color-accent-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FolderPlus size={22} weight="fill" />
      </Box>
      <Stack spacing={0.5}>
        <Typography variant="body1" fontWeight={600} sx={{ color: "var(--bs-text-default)" }}>
          No projects yet
        </Typography>
        <Typography variant="body2" sx={{ color: "var(--bs-text-muted)", maxWidth: 360 }}>
          Projects group the patterns you create in BrandSync Make. Start one to keep your work organized.
        </Typography>
      </Stack>
      <Button
        variant="contained"
        startIcon={<Plus size={14} weight="bold" />}
        onClick={onCreate}
        sx={{
          textTransform: "none",
          bgcolor: "var(--bs-color-accent-default)",
          color: "var(--bs-text-inverse)",
          "&:hover": { bgcolor: "var(--bs-color-accent-hover)" },
        }}
      >
        Create your first project
      </Button>
    </Stack>
  );
}

function NewProjectForm({ onCancel, onCreated }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: USER_EMAIL, name: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      onCreated(body.project);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <Stack
      spacing={1.5}
      sx={{
        p: 2,
        bgcolor: "var(--bs-surface-raised)",
        border: "1px solid var(--bs-border-default)",
        borderRadius: "var(--bs-border-radius-150)",
      }}
    >
      <Typography variant="body2" fontWeight={600} sx={{ color: "var(--bs-text-default)" }}>
        Name your project
      </Typography>
      <InputBase
        autoFocus
        placeholder="e.g. Vigilo onboarding redesign"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        sx={{
          px: 1.5,
          py: 1,
          color: "var(--bs-text-default)",
          fontSize: "var(--bs-font-size-md)",
          bgcolor: "var(--bs-surface-base)",
          border: "1px solid var(--bs-border-default)",
          borderRadius: "var(--bs-border-radius-100)",
          "&:focus-within": { borderColor: "var(--bs-border-primary)" },
        }}
      />
      {error && (
        <Typography variant="caption" sx={{ color: "var(--bs-color-error-default)" }}>
          {error}
        </Typography>
      )}
      <Stack direction="row" justifyContent="flex-end" gap={1}>
        <Button
          size="small"
          onClick={onCancel}
          sx={{
            textTransform: "none",
            color: "var(--bs-text-default)",
            "&:hover": { bgcolor: "var(--bs-surface-hover)" },
          }}
        >
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!canSubmit}
          onClick={submit}
          sx={{
            textTransform: "none",
            bgcolor: "var(--bs-color-accent-default)",
            color: "var(--bs-text-inverse)",
            "&:hover": { bgcolor: "var(--bs-color-accent-hover)" },
          }}
        >
          {submitting ? "Creating…" : "Create"}
        </Button>
      </Stack>
    </Stack>
  );
}

export default function ProjectsDialog({ open, onClose }) {
  const router = useRouter();
  const [projects, setProjects] = useState(null); // null = not loaded yet
  const [loadError, setLoadError] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/projects?userEmail=${encodeURIComponent(USER_EMAIL)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setProjects(body.projects || []);
    } catch (e) {
      setLoadError(e.message);
      setProjects([]);
    }
  };

  useEffect(() => {
    if (open) {
      setCreating(false);
      setProjects(null);
      load();
    }
  }, [open]);

  const openProject = (project) => {
    onClose?.();
    router.push(`/brandsync-make/my-patterns?projectId=${project.id}`);
  };

  const handleCreated = (project) => {
    setProjects((prev) => [{ ...project, file_count: 0 }, ...(prev || [])]);
    setCreating(false);
    openProject(project);
  };

  const showEmpty = projects && projects.length === 0 && !creating;

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
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          py: 2.5,
          px: 4,
          borderBottom: "1px solid var(--bs-border-default)",
        }}
      >
        <Stack>
          <Typography variant="h6" fontWeight={700} sx={{ color: "var(--bs-text-default)" }}>
            Open project
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--bs-text-muted)" }}>
            Pick up where you left off, or start something new.
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1}>
          {projects && projects.length > 0 && !creating && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Plus size={14} weight="bold" />}
              onClick={() => setCreating(true)}
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
              New project
            </Button>
          )}
          <IconButton onClick={onClose} size="small" aria-label="Close">
            <X size={18} />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 4, py: 4 }}>
        <Stack spacing={1.5}>
          {creating && (
            <NewProjectForm onCancel={() => setCreating(false)} onCreated={handleCreated} />
          )}

          {projects === null && !loadError && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={24} sx={{ color: "var(--bs-color-accent-default)" }} />
            </Box>
          )}

          {loadError && (
            <Typography variant="body2" sx={{ color: "var(--bs-color-error-default)" }}>
              Couldn't load projects: {loadError}
            </Typography>
          )}

          {showEmpty && <EmptyState onCreate={() => setCreating(true)} />}

          {projects && projects.length > 0 && (
            <Stack spacing={1}>
              {projects.map((p) => (
                <ProjectRow key={p.id} project={p} onOpen={openProject} />
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
