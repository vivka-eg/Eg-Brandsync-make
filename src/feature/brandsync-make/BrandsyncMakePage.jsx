"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Container,
  Stack,
  Typography,
  IconButton,
  InputBase,
  Button,
  Menu,
  MenuItem,
  ListSubheader,
  Divider,
} from "@mui/material";
import { Plus, Microphone, GridFour, CaretDown, Ticket, SquaresFour, Check, FolderOpen, X } from "phosphor-react";
import PatternsDialog from "./PatternsDialog";
import HandoffDialog from "./HandoffDialog";
import ProjectsDialog from "./ProjectsDialog";

const MODELS = [
  { id: "default", label: "Default", description: "Recommended" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Balanced, efficient" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", description: "Thorough, uses more credits" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", description: "Fast, iterative" },
  { id: "gemini-3-1-pro", label: "Gemini 3.1 Pro", description: "Deep, creative" },
];

function PromptBar({
  contextProject, onClearContext,
  projects = [], onPickProject, onCreateProject,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [projectsAnchor, setProjectsAnchor] = useState(null);
  const [modelId, setModelId] = useState("default");
  const selectedModel = MODELS.find((m) => m.id === modelId);

  const closeProjects = () => setProjectsAnchor(null);

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "var(--bs-surface-raised)",
        border: "1px solid var(--bs-border-default)",
        borderRadius: "var(--bs-border-radius-full)",
        px: 1,
        py: 1,
      }}
    >
      <IconButton
        size="small"
        aria-label="Attach"
        sx={{
          bgcolor: "transparent",
          border: "1px solid var(--bs-border-default)",
          color: "var(--bs-text-default)",
          width: 40,
          height: 40,
        }}
      >
        <Plus size={18} weight="bold" />
      </IconButton>

      <InputBase
        fullWidth
        placeholder="Describe your idea. Attach a design to guide the result."
        sx={{
          flex: 1,
          color: "var(--bs-text-default)",
          fontSize: "var(--bs-font-size-md)",
          "& input::placeholder": {
            color: "var(--bs-text-muted)",
            opacity: 1,
          },
        }}
        inputProps={{ "aria-label": "Describe your idea" }}
      />

      <Button
        size="small"
        endIcon={<CaretDown size={14} weight="bold" />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          color: "var(--bs-text-default)",
          textTransform: "none",
          fontWeight: 500,
          px: 1.5,
          "&:hover": { bgcolor: "var(--bs-surface-hover)" },
        }}
      >
        {selectedModel.label}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 280,
              mt: -1,
              bgcolor: "var(--bs-surface-raised)",
              border: "1px solid var(--bs-border-default)",
              borderRadius: "var(--bs-border-radius-200)",
              boxShadow: "var(--bs-shadow-lg)",
              overflow: "hidden",
            },
          },
          list: { sx: { py: 0.5 } },
        }}
      >
        <ListSubheader
          disableSticky
          sx={{
            bgcolor: "transparent",
            color: "var(--bs-text-muted)",
            fontSize: "var(--bs-font-size-xs)",
            fontWeight: 500,
            lineHeight: 1,
            px: 2,
            py: 1.25,
          }}
        >
          Select model
        </ListSubheader>
        {MODELS.map((m) => {
          const isSelected = m.id === modelId;
          return (
            <MenuItem
              key={m.id}
              selected={isSelected}
              onClick={() => {
                setModelId(m.id);
                setAnchorEl(null);
              }}
              sx={{
                px: 2,
                py: 1,
                gap: 1.5,
                alignItems: "flex-start",
                "&.Mui-selected, &.Mui-selected:hover": {
                  bgcolor: "transparent",
                },
                "&:hover": { bgcolor: "var(--bs-surface-hover)" },
              }}
            >
              <Box sx={{ width: 16, pt: 0.25, flexShrink: 0 }}>
                {isSelected && <Check size={14} weight="bold" color="var(--bs-text-default)" />}
              </Box>
              <Stack spacing={0.25}>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  sx={{ color: "var(--bs-text-default)", lineHeight: 1.3 }}
                >
                  {m.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "var(--bs-text-muted)", lineHeight: 1.3 }}
                >
                  {m.description}
                </Typography>
              </Stack>
            </MenuItem>
          );
        })}
      </Menu>

      {contextProject ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.25}
          sx={{
            pl: 1.25,
            pr: 0.5,
            py: 0.5,
            bgcolor: "var(--bs-color-accent-container)",
            color: "var(--bs-color-accent-default)",
            border: "1px solid var(--bs-color-accent-default)",
            borderRadius: "var(--bs-border-radius-full)",
            maxWidth: 220,
            cursor: "pointer",
            "&:hover": { opacity: 0.92 },
          }}
          onClick={(e) => setProjectsAnchor(e.currentTarget)}
          role="button"
          aria-label="Switch project"
          aria-haspopup="menu"
          aria-expanded={Boolean(projectsAnchor)}
        >
          <FolderOpen size={14} weight="fill" />
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{
              color: "inherit",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 130,
              px: 0.5,
            }}
          >
            {contextProject.name}
          </Typography>
          <CaretDown size={10} weight="bold" />
          <IconButton
            size="small"
            aria-label="Clear project context"
            onClick={(e) => { e.stopPropagation(); onClearContext(); }}
            sx={{
              width: 20,
              height: 20,
              ml: 0.5,
              color: "inherit",
              "&:hover": { bgcolor: "transparent", opacity: 0.7 },
            }}
          >
            <X size={11} weight="bold" />
          </IconButton>
        </Stack>
      ) : (
        <IconButton
          size="small"
          aria-label="Open project"
          title="Open a project"
          onClick={(e) => setProjectsAnchor(e.currentTarget)}
          sx={{
            border: "1px solid var(--bs-border-default)",
            color: "var(--bs-text-default)",
            width: 40,
            height: 40,
            "&:hover": { bgcolor: "var(--bs-surface-hover)" },
          }}
        >
          <GridFour size={18} weight="regular" />
        </IconButton>
      )}

      <Menu
        anchorEl={projectsAnchor}
        open={Boolean(projectsAnchor)}
        onClose={closeProjects}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 260,
              mt: -1,
              bgcolor: "var(--bs-surface-raised)",
              border: "1px solid var(--bs-border-default)",
              borderRadius: "var(--bs-border-radius-200)",
              boxShadow: "var(--bs-shadow-lg)",
              overflow: "hidden",
            },
          },
          list: { sx: { py: 0.5 } },
        }}
      >
        <ListSubheader
          disableSticky
          sx={{
            bgcolor: "transparent",
            color: "var(--bs-text-muted)",
            fontSize: "var(--bs-font-size-xs)",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            lineHeight: 1,
            px: 2,
            py: 1.25,
          }}
        >
          {contextProject ? "Switch project" : "Your projects"}
        </ListSubheader>

        {projects.length === 0 && (
          <MenuItem disabled sx={{ px: 2, py: 1, fontSize: 13, color: "var(--bs-text-muted)" }}>
            No projects yet
          </MenuItem>
        )}

        {projects.slice(0, 8).map((p) => {
          const isActive = p.id === contextProject?.id;
          return (
            <MenuItem
              key={p.id}
              onClick={() => { onPickProject?.(p); closeProjects(); }}
              sx={{
                px: 2,
                py: 1,
                gap: 1.25,
                bgcolor: isActive ? "var(--bs-color-accent-container)" : "transparent",
                "&:hover": {
                  bgcolor: isActive
                    ? "var(--bs-color-accent-container)"
                    : "var(--bs-surface-hover)",
                },
              }}
            >
              <FolderOpen
                size={14}
                weight={isActive ? "fill" : "regular"}
                color="var(--bs-color-accent-default)"
              />
              <Typography
                variant="body2"
                sx={{
                  color: isActive ? "var(--bs-color-accent-default)" : "var(--bs-text-default)",
                  fontWeight: isActive ? 600 : 400,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </Typography>
              {isActive && <Check size={12} weight="bold" color="var(--bs-color-accent-default)" />}
              <Typography variant="caption" sx={{ color: "var(--bs-text-muted)", flexShrink: 0 }}>
                {p.file_count ?? 0}
              </Typography>
            </MenuItem>
          );
        })}

        <Divider sx={{ my: 0.5, borderColor: "var(--bs-border-default)" }} />

        <MenuItem
          onClick={() => { onCreateProject?.(); closeProjects(); }}
          sx={{
            px: 2, py: 1, gap: 1.25,
            color: "var(--bs-color-accent-default)",
            fontWeight: 500,
            "&:hover": { bgcolor: "var(--bs-surface-hover)" },
          }}
        >
          <Plus size={14} weight="bold" />
          <Typography variant="body2" sx={{ color: "inherit", fontWeight: 600 }}>
            New project
          </Typography>
        </MenuItem>
      </Menu>

      <IconButton
        aria-label="Voice input"
        sx={{
          bgcolor: "var(--bs-color-accent-default)",
          color: "var(--bs-text-inverse)",
          width: 40,
          height: 40,
          "&:hover": { bgcolor: "var(--bs-color-accent-hover)" },
        }}
      >
        <Microphone size={18} weight="fill" />
      </IconButton>
    </Box>
  );
}

function OptionCard({ title, subtitle, preview, onClick }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      sx={{
        position: "relative",
        bgcolor: "var(--bs-surface-raised)",
        border: "1px solid var(--bs-border-default)",
        borderRadius: "var(--bs-border-radius-200)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s, transform 0.15s",
        "&:hover": {
          borderColor: "var(--bs-border-neutral-hover)",
          transform: "translateY(-2px)",
        },
        "&:focus-visible": {
          outline: "2px solid var(--bs-border-primary)",
          outlineOffset: 2,
        },
      }}
    >
      <Stack spacing={0.5} sx={{ p: 3, textAlign: "center" }}>
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{ color: "var(--bs-text-default)" }}
        >
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: "var(--bs-text-muted)" }}>
          {subtitle}
        </Typography>
      </Stack>
      <Box
        sx={{
          height: 180,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          px: 4,
          pb: 0,
        }}
      >
        {preview}
      </Box>
    </Box>
  );
}

function HandoffPreview() {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 280,
        height: 140,
        borderRadius: "var(--bs-border-radius-150) var(--bs-border-radius-150) 0 0",
        bgcolor: "var(--bs-surface-base)",
        border: "1px solid var(--bs-border-default)",
        borderBottom: "none",
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1}>
        <Box
          sx={{
            px: 1,
            py: 0.25,
            bgcolor: "var(--bs-color-info-container)",
            color: "var(--bs-color-info-default)",
            borderRadius: "var(--bs-border-radius-50)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          APT-202
        </Box>
        <Ticket size={14} color="var(--bs-text-muted)" />
        <Box sx={{ flex: 1, height: 4, bgcolor: "var(--bs-color-neutral-container)", borderRadius: 4 }} />
      </Stack>
      <Stack spacing={0.75}>
        <Box sx={{ height: 4, bgcolor: "var(--bs-color-neutral-container)", borderRadius: 4 }} />
        <Box sx={{ height: 4, bgcolor: "var(--bs-color-neutral-container)", borderRadius: 4, width: "85%" }} />
        <Box sx={{ height: 4, bgcolor: "var(--bs-color-neutral-container)", borderRadius: 4, width: "60%" }} />
      </Stack>
      <Stack direction="row" gap={0.75} sx={{ mt: "auto" }}>
        {["#0073e1", "#715afc", "#00855b"].map((c) => (
          <Box
            key={c}
            sx={{
              px: 0.75,
              py: 0.25,
              fontSize: 9,
              fontWeight: 600,
              borderRadius: "var(--bs-border-radius-full)",
              bgcolor: `${c}22`,
              color: c,
              border: `1px solid ${c}44`,
            }}
          >
            tag
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function PatternsPreview() {
  const patterns = [
    { label: "Dashboard", accent: "#0073e1" },
    { label: "Form", accent: "#715afc" },
    { label: "Settings", accent: "#00855b" },
    { label: "Wizard", accent: "#b18100" },
  ];
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 280,
        height: 140,
        borderRadius: "var(--bs-border-radius-150) var(--bs-border-radius-150) 0 0",
        bgcolor: "var(--bs-surface-base)",
        border: "1px solid var(--bs-border-default)",
        borderBottom: "none",
        p: 1.5,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 1,
      }}
    >
      {patterns.map(({ label, accent }) => (
        <Box
          key={label}
          sx={{
            bgcolor: "var(--bs-surface-container)",
            border: "1px solid var(--bs-border-default)",
            borderRadius: "var(--bs-border-radius-75)",
            p: 0.75,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            position: "relative",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: accent,
            }}
          />
          <SquaresFour size={12} color="var(--bs-text-muted)" />
          <Box sx={{ height: 3, bgcolor: "var(--bs-color-neutral-container)", borderRadius: 3, width: "70%" }} />
          <Box
            sx={{
              flex: 1,
              bgcolor: `${accent}1f`,
              borderRadius: "var(--bs-border-radius-50)",
              minHeight: 18,
            }}
          />
          <Box
            sx={{
              fontSize: 8,
              fontWeight: 600,
              color: "var(--bs-text-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function ProjectsPreview() {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 280,
        height: 140,
        borderRadius: "var(--bs-border-radius-150) var(--bs-border-radius-150) 0 0",
        bgcolor: "var(--bs-surface-base)",
        border: "1px solid var(--bs-border-default)",
        borderBottom: "none",
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
      }}
    >
      {[
        { name: "Vigilo onboarding", count: 6 },
        { name: "Sensum dashboard", count: 4 },
        { name: "Brand guidelines", count: 9 },
      ].map((p, i) => (
        <Stack
          key={p.name}
          direction="row"
          alignItems="center"
          gap={1}
          sx={{
            bgcolor: "var(--bs-surface-container)",
            border: "1px solid var(--bs-border-default)",
            borderRadius: "var(--bs-border-radius-75)",
            px: 1,
            py: 0.75,
          }}
        >
          <FolderOpen size={12} color="var(--bs-color-accent-default)" weight="fill" />
          <Box sx={{ flex: 1, height: 4, bgcolor: "var(--bs-color-neutral-container)", borderRadius: 3, width: `${70 - i * 10}%` }} />
          <Box
            sx={{
              fontSize: 9,
              fontWeight: 600,
              color: "var(--bs-text-muted)",
              minWidth: 14,
              textAlign: "right",
            }}
          >
            {p.count}
          </Box>
        </Stack>
      ))}
    </Box>
  );
}

export default function BrandsyncMakePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [patternsOpen, setPatternsOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projects, setProjects] = useState([]);

  // Load the user's projects once on mount so the in-prompt picker has
  // them ready, and so we can resolve `projectId` from the URL into a
  // human-readable contextProject without an extra fetch.
  useEffect(() => {
    fetch(`/api/projects?userEmail=${encodeURIComponent("vivka@eg.dk")}`)
      .then((r) => r.json())
      .then((body) => setProjects(body.projects ?? []))
      .catch(() => setProjects([]));
  }, []);

  const contextProject = projectId ? projects.find((p) => p.id === projectId) ?? null : null;

  return (
    <Box sx={{ minHeight: "calc(100vh - 64px)", display: "flex", alignItems: "center", py: 8 }}>
      <Container maxWidth="lg">
        <Stack spacing={5} alignItems="center">
          <Typography
            variant="h3"
            fontWeight={600}
            textAlign="center"
            sx={{ color: "var(--bs-text-default)" }}
          >
            What do you want to make?
          </Typography>

          <PromptBar
            contextProject={contextProject}
            onClearContext={() => router.push("/brandsync-make")}
            projects={projects}
            onPickProject={(p) => router.push(`/brandsync-make?projectId=${p.id}`)}
            onCreateProject={() => setProjectsOpen(true)}
          />

          <Box
            sx={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
              gap: 3,
            }}
          >
            <OptionCard
              title="Open project"
              subtitle="Pick up where you left off"
              preview={<ProjectsPreview />}
              onClick={() => setProjectsOpen(true)}
            />
            <OptionCard
              title="Load handoff"
              subtitle="Load handoff for a Jira ticket"
              preview={<HandoffPreview />}
              onClick={() => setHandoffOpen(true)}
            />
            <OptionCard
              title="Start from BrandSync patterns"
              subtitle="Browse patterns from the AI & MCP library"
              preview={<PatternsPreview />}
              onClick={() => setPatternsOpen(true)}
            />
          </Box>
        </Stack>
      </Container>

      <PatternsDialog open={patternsOpen} onClose={() => setPatternsOpen(false)} />
      <HandoffDialog open={handoffOpen} onClose={() => setHandoffOpen(false)} />
      <ProjectsDialog open={projectsOpen} onClose={() => setProjectsOpen(false)} />
    </Box>
  );
}
