'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// Monaco is large + relies on browser-only APIs (Web Workers, document).
// Client-only import keeps it out of SSR and ensures it lazy-loads when
// the user actually opens Source mode.
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
import {
  Eye,
  Code,
  ArrowsClockwise,
  Desktop,
  DeviceTablet,
  DeviceMobile,
  Gear,
  Plus,
  Sun,
  Moon,
  PaperPlaneRight,
  CaretDown,
  Smiley,
  House,
  CircleNotch,
  Cube,
  FolderOpen,
  Check,
} from '@phosphor-icons/react';
import ComponentsDrawer from '@/feature/brandsync-make/ComponentsDrawer';
import { BRAND_PALETTES, brandOverrideCss, substituteBrand } from '@/lib/brand-substitute';

// Standard responsive breakpoints used in the viewport toggle.
const VIEWPORTS = {
  desktop: { label: 'Desktop', width: 1280, height: 800, icon: Desktop },
  tablet:  { label: 'Tablet',  width: 768,  height: 1024, icon: DeviceTablet },
  mobile:  { label: 'Mobile',  width: 375,  height: 812,  icon: DeviceMobile },
};

// Parse a pattern's markdown content into its fenced code blocks. Used by
// both the preview builder and the source-mode editor so they stay in sync.
function parseSources(content = '') {
  return {
    html: content.match(/```html\n([\s\S]*?)```/)?.[1] ?? '',
    css:  content.match(/```css\n([\s\S]*?)```/)?.[1]  ?? '',
    js:   content.match(/```(?:js|javascript)\n([\s\S]*?)```/)?.[1] ?? '',
  };
}

// The preview doc has two parts:
//   - HEAD: tokens.css (~17k chars) + brand palette override + base layout
//     CSS. Stable across edits — depends only on tokensCss, brandPalette, theme.
//   - BODY: parsed html + scoped css + js, plus the brand-substituted markup.
//     Changes on every Monaco keystroke.
// Splitting lets Canvas memoize the head once per theme/palette change so
// each keystroke only re-concats the lightweight body half.
function buildPreviewHead(tokensCss, theme, brandPalette) {
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400;500;700;900&display=swap">
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css">
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css">
    <style>${tokensCss}</style>
    <style>${brandOverrideCss(brandPalette)}</style>`;
}

function buildPreviewDoc(content, tokensCss, theme, brandPalette, selectedLogo, edits, head) {
  const parsed = parseSources(content);
  const css = edits?.css ?? parsed.css;
  const js  = edits?.js  ?? parsed.js;
  let html  = edits?.html ?? parsed.html;
  if (!html && !css) return null;

  html = substituteBrand(html, theme, selectedLogo);
  const headPart = head ?? buildPreviewHead(tokensCss, theme, brandPalette);

  return `${headPart}
    <style>
      html, body { margin: 0; padding: 0; background: var(--bs-surface-base); color: var(--bs-text-default); font-family: var(--bs-typography-font-family-body), system-ui, sans-serif; }
      html, body { scrollbar-width: none; -ms-overflow-style: none; }
      html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
      ${css}
    </style>
  </head>
  <body>${html}${js ? `<script>${js}</script>` : ''}</body>
</html>`;
}

// ───────────────────── tokens (UI shell only — not Brandsync's design tokens) ─────────────────────

const ui = {
  bg:         '#f5f6f8',   // app background — slight cool tint
  canvas:     '#eceef2',   // canvas area around the iframe (slightly darker)
  panel:      '#ffffff',   // top bar + sidebar
  panelLine:  '#e4e6eb',   // subtle borders
  text:       '#15181d',
  textMuted:  '#5d6470',
  textFaint:  '#9097a3',
  pill:       '#f3f4f7',
  pillBorder: '#e0e3e9',
  accent:     '#1a1d23',   // near-black for send button etc.
  accentText: '#ffffff',
};

// ───────────────────── components ─────────────────────

function ProjectSwitcher({
  projects, activeProject, open, setOpen,
  onSwitch, onCreate,
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      await onCreate(name);
      setNewName('');
      setCreating(false);
    } finally {
      setSubmitting(false);
    }
  };

  const label = activeProject?.name ?? 'No project';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={activeProject ? `Project: ${activeProject.name}` : 'Pick a project'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 8px 3px 7px',
          background: activeProject ? ui.pill : 'transparent',
          color: activeProject ? ui.text : ui.textMuted,
          border: `1px solid ${activeProject ? ui.pillBorder : ui.panelLine}`,
          borderRadius: 999,
          fontSize: 12, lineHeight: 1, cursor: 'pointer',
          fontFamily: 'inherit',
          maxWidth: 200,
        }}
      >
        <FolderOpen size={12} weight={activeProject ? 'fill' : 'regular'} />
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 140,
        }}>{label}</span>
        <CaretDown size={10} />
      </button>

      {open && (
        <>
          {/* backdrop to close on outside click */}
          <div
            onClick={() => { setOpen(false); setCreating(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          />
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 51,
            minWidth: 280, maxWidth: 320,
            background: ui.panel, border: `1px solid ${ui.panelLine}`,
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: 6,
          }}>
            <div style={{
              padding: '6px 10px 4px', fontSize: 10, fontWeight: 600,
              letterSpacing: 0.5, textTransform: 'uppercase',
              color: ui.textFaint,
            }}>Switch project</div>

            {projects.length === 0 && !creating && (
              <div style={{ padding: '8px 10px', fontSize: 12, color: ui.textMuted }}>
                No projects yet.
              </div>
            )}

            {projects.length > 0 && (
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {/* "No project" reset */}
                <button
                  onClick={() => onSwitch(null)}
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 6,
                    background: !activeProject ? ui.pill : 'transparent',
                    border: '1px solid transparent',
                    color: ui.textMuted, fontSize: 12, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ width: 12, display: 'inline-flex', justifyContent: 'center' }}>
                    {!activeProject && <Check size={10} />}
                  </span>
                  <span>No project</span>
                </button>
                {projects.map(p => {
                  const isActive = p.id === activeProject?.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSwitch(p.id)}
                      style={{
                        width: '100%', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', borderRadius: 6,
                        background: isActive ? ui.pill : 'transparent',
                        border: '1px solid transparent',
                        color: ui.text, fontSize: 12, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ width: 12, display: 'inline-flex', justifyContent: 'center' }}>
                        {isActive && <Check size={10} />}
                      </span>
                      <span style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: ui.textFaint }}>
                        {p.file_count} {p.file_count === 1 ? 'file' : 'files'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ height: 1, background: ui.panelLine, margin: '6px 0' }} />

            {creating ? (
              <div style={{ padding: '4px 6px 6px' }}>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitCreate();
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  placeholder="Project name…"
                  style={{
                    width: '100%', padding: '6px 8px',
                    background: ui.bg, border: `1px solid ${ui.panelLine}`,
                    borderRadius: 6, fontSize: 12, color: ui.text,
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                  <button
                    onClick={() => { setCreating(false); setNewName(''); }}
                    style={{
                      padding: '4px 10px', fontSize: 11,
                      background: 'transparent', color: ui.textMuted,
                      border: 'none', borderRadius: 6, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >Cancel</button>
                  <button
                    onClick={submitCreate}
                    disabled={!newName.trim() || submitting}
                    style={{
                      padding: '4px 10px', fontSize: 11,
                      background: ui.accent, color: ui.accentText,
                      border: 'none', borderRadius: 6, cursor: 'pointer',
                      fontFamily: 'inherit',
                      opacity: !newName.trim() || submitting ? 0.5 : 1,
                    }}
                  >{submitting ? 'Creating…' : 'Create'}</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 6,
                  background: 'transparent', border: '1px solid transparent',
                  color: ui.text, fontSize: 12, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Plus size={12} weight="bold" />
                <span>New project</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TopBar({
  title, mode, onModeChange, onOpenComponents, onGoHome,
  projects, activeProject, projectMenuOpen, setProjectMenuOpen,
  onSwitchProject, onCreateProject,
}) {
  return (
    <header style={{
      height: 56, display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 20px',
      background: ui.panel,
      borderBottom: `1px solid ${ui.panelLine}`,
      color: ui.text,
      fontSize: 13,
    }}>
      <button
        onClick={onGoHome}
        aria-label="Back to BrandSync Make"
        title="Back to BrandSync Make"
        style={{
          width: 22, height: 22, borderRadius: 4, padding: 0,
          background: 'linear-gradient(135deg,#f04 0%,#a0f 50%,#0af 100%)',
          border: 'none', cursor: 'pointer',
        }}
      />
      <ProjectSwitcher
        projects={projects}
        activeProject={activeProject}
        open={projectMenuOpen}
        setOpen={setProjectMenuOpen}
        onSwitch={onSwitchProject}
        onCreate={onCreateProject}
      />
      <span style={{ color: ui.textFaint, fontSize: 12 }}>/</span>
      <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{title}</span>
      <span style={{ ...pillStyle, fontSize: 10, padding: '2px 7px' }}>AI</span>

      <div style={{ flex: 1 }} />

      <PillGroup>
        <IconButton active={mode === 'preview'} onClick={() => onModeChange('preview')} label="Preview" icon={Eye} />
        <IconButton active={mode === 'source'}  onClick={() => onModeChange('source')}  label="Source"  icon={Code} />
      </PillGroup>
      <IconButton label="Refresh" icon={ArrowsClockwise} />

      <div style={{ flex: 1 }} />

      {/* Components library drawer trigger */}
      <IconButton label="Components" icon={Cube} onClick={onOpenComponents} />

      <span style={{ ...pillStyle, fontSize: 10, padding: '2px 7px' }}>AI</span>
      <IconButton label="Settings" icon={Gear} />
    </header>
  );
}

function PillGroup({ children }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      background: ui.panel, borderRadius: 8,
      border: `1px solid ${ui.panelLine}`,
      padding: 2,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>{children}</div>
  );
}

function CanvasControlBar({ viewport, onViewportChange, theme, onThemeChange }) {
  const vp = VIEWPORTS[viewport];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 10, marginBottom: 20,
    }}>
      <PillGroup>
        {Object.entries(VIEWPORTS).map(([key, def]) => (
          <IconButton
            key={key}
            active={viewport === key}
            onClick={() => onViewportChange(key)}
            label={def.label}
            icon={def.icon}
          />
        ))}
        <span style={{
          padding: '0 12px 0 10px',
          fontSize: 11, color: ui.textMuted,
          fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
          whiteSpace: 'nowrap',
        }}>
          {vp.width} × {vp.height}
        </span>
      </PillGroup>

      <PillGroup>
        <IconButton
          active={theme === 'light'}
          onClick={() => onThemeChange('light')}
          label="Light"
          icon={Sun}
        />
        <IconButton
          active={theme === 'dark'}
          onClick={() => onThemeChange('dark')}
          label="Dark"
          icon={Moon}
        />
      </PillGroup>
    </div>
  );
}

const pillStyle = {
  display: 'inline-flex', alignItems: 'center',
  background: ui.pill, color: ui.text,
  border: `1px solid ${ui.pillBorder}`,
  borderRadius: 999, padding: '3px 10px',
  fontSize: 12, lineHeight: 1,
};

function IconButton({ icon: Icon, label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 30, height: 30, display: 'grid', placeItems: 'center',
        background: active ? ui.pill : 'transparent',
        color: active ? ui.text : ui.textMuted,
        border: `1px solid ${active ? ui.pillBorder : 'transparent'}`,
        borderRadius: 6, cursor: 'pointer',
      }}
    ><Icon size={16} weight="regular" /></button>
  );
}

function PatternRowMenu({ items }) {
  // Tiny popover menu used by both PatternListItem (global) and
  // FileListItem (in-project). Built locally so it can stop event
  // propagation cleanly — clicking the kebab shouldn't also select the
  // row, and clicking a menu item shouldn't either.
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState(null);

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ position: 'absolute', top: 8, right: 8 }}
    >
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); setSubmenu(null); }}
        aria-label="More actions"
        title="More actions"
        style={{
          width: 22, height: 22, display: 'grid', placeItems: 'center',
          background: open ? ui.pill : ui.bg,
          color: ui.textMuted,
          border: `1px solid ${ui.panelLine}`,
          borderRadius: 5, cursor: 'pointer',
          fontFamily: 'inherit',
          padding: 0,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 0.6, letterSpacing: -1 }}>⋯</span>
      </button>

      {open && (
        <>
          {/* close on outside click */}
          <div
            onClick={e => { e.stopPropagation(); setOpen(false); setSubmenu(null); }}
            style={{ position: 'fixed', inset: 0, zIndex: 80 }}
          />
          <div style={{
            position: 'absolute', top: 26, right: 0, zIndex: 81,
            minWidth: 200,
            background: ui.panel, border: `1px solid ${ui.panelLine}`,
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 4,
          }}>
            {items.map((item, idx) => {
              if (item.divider) {
                return <div key={`div-${idx}`} style={{ height: 1, background: ui.panelLine, margin: '4px 0' }} />;
              }
              if (item.submenu) {
                const isOpen = submenu === idx;
                return (
                  <div key={item.label} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setSubmenu(isOpen ? null : idx)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', textAlign: 'left',
                        padding: '6px 10px', borderRadius: 5,
                        background: isOpen ? ui.pill : 'transparent',
                        border: 0, cursor: 'pointer',
                        color: ui.text, fontSize: 12,
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = ui.pill; }}
                      onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span>{item.label}</span>
                      <span style={{ fontSize: 11, color: ui.textMuted }}>▸</span>
                    </button>
                    {isOpen && (
                      <div style={{
                        position: 'absolute', top: 0, left: '100%',
                        marginLeft: 4, minWidth: 200,
                        background: ui.panel, border: `1px solid ${ui.panelLine}`,
                        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        padding: 4, zIndex: 82,
                      }}>
                        {item.submenu.length === 0 ? (
                          <div style={{ padding: '6px 10px', fontSize: 11.5, color: ui.textMuted }}>
                            No other projects
                          </div>
                        ) : item.submenu.map(sub => (
                          <button
                            key={sub.label}
                            onClick={() => { sub.onClick(); setOpen(false); setSubmenu(null); }}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left',
                              padding: '6px 10px', borderRadius: 5,
                              background: 'transparent', border: 0, cursor: 'pointer',
                              color: ui.text, fontSize: 12,
                              fontFamily: 'inherit',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = ui.pill; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >{sub.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={item.label}
                  onClick={() => { item.onClick(); setOpen(false); setSubmenu(null); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 10px', borderRadius: 5,
                    background: 'transparent', border: 0, cursor: 'pointer',
                    color: item.destructive ? '#b91c1c' : ui.text,
                    fontSize: 12,
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = item.destructive ? '#fdecec' : ui.pill;
                  }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >{item.label}</button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PatternListItem({ pattern, selected, onClick, menuItems }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        textAlign: 'left',
        width: '100%',
        background: selected ? ui.pill : 'transparent',
        color: selected ? ui.text : ui.textMuted,
        border: `1px solid ${selected ? ui.pillBorder : 'transparent'}`,
        borderRadius: 10, padding: '12px 36px 12px 14px',
        fontSize: 13, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 3,
      }}
    >
      <span style={{ fontWeight: 500, color: ui.text }}>{pattern.slug}</span>
      <span style={{ fontSize: 11, color: ui.textFaint }}>
        {pattern.type}
        {pattern.created_by_email ? ` · ${pattern.created_by_email}` : ''}
      </span>
      {hover && menuItems?.length > 0 && <PatternRowMenu items={menuItems} />}
    </div>
  );
}

function BrandSection({
  selectedLogo, onPickLogo, logoMenuOpen, setLogoMenuOpen,
  logos, logosLoading, logosError, onEnsureLogosLoaded,
  brandPalette, setBrandPalette, colorMenuOpen, setColorMenuOpen,
}) {
  // Sidebar bg is white — prefer dark-colored logos (dark.horizontal),
  // fall back to icon mark (logo), then to light (which is white-on-dark
  // and won't read on a white sidebar).
  const logoUrl = selectedLogo?.assets?.dark?.horizontal
    || selectedLogo?.assets?.logo
    || selectedLogo?.assets?.light?.horizontal
    || null;

  return (
    <div style={{ padding: '14px 20px 16px', borderBottom: `1px solid ${ui.panelLine}` }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
        color: ui.textFaint, textTransform: 'uppercase', marginBottom: 10,
      }}>Brand</div>

      <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
        {/* Logo picker */}
        <button
          onClick={() => { onEnsureLogosLoaded(); setLogoMenuOpen(o => !o); setColorMenuOpen(false); }}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px',
            background: ui.bg, border: `1px solid ${ui.panelLine}`,
            borderRadius: 8, cursor: 'pointer', textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          <span style={{
            width: 28, height: 28, borderRadius: 4,
            background: '#fff', border: `1px solid ${ui.panelLine}`,
            display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden',
          }}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="" style={{ maxWidth: '90%', maxHeight: '90%' }} />
              : <span style={{ fontSize: 14, color: ui.textFaint }}>?</span>}
          </span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, color: ui.text }}>
            {selectedLogo?.name ?? 'Pick a logo'}
          </span>
          <CaretDown size={12} color={ui.textMuted} />
        </button>

        {/* Color picker */}
        <button
          onClick={() => { setColorMenuOpen(o => !o); setLogoMenuOpen(false); }}
          aria-label="Brand color"
          title={`Brand color: ${brandPalette}`}
          style={{
            width: 44, height: 44, padding: 0,
            background: ui.bg, border: `1px solid ${ui.panelLine}`,
            borderRadius: 8, cursor: 'pointer',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            background: `var(--bs-brand-colors-${brandPalette}-500)`,
            border: `1px solid ${ui.panelLine}`,
          }} />
        </button>

        {logoMenuOpen && (
          <BrandPopover anchor="left" onClose={() => setLogoMenuOpen(false)}>
            {logosLoading ? (
              <div style={{ padding: 16, fontSize: 12, color: ui.textMuted }}>Loading logos…</div>
            ) : logos.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: '#b00020', lineHeight: 1.5 }}>
                {logosError ?? 'No logos loaded. Is Strapi running at localhost:1337?'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: 8, maxHeight: 320, overflow: 'auto' }}>
                {logos.map(l => {
                  const thumb = l.assets?.dark?.horizontal || l.assets?.logo || l.assets?.light?.horizontal;
                  const isSel = selectedLogo?.id === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => { onPickLogo(l); setLogoMenuOpen(false); }}
                      title={l.name}
                      style={{
                        padding: 6, background: isSel ? ui.pill : '#fff',
                        border: `1px solid ${isSel ? ui.accent : ui.panelLine}`,
                        borderRadius: 6, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      }}
                    >
                      <span style={{
                        width: '100%', height: 40, display: 'grid', placeItems: 'center',
                        background: '#fff', borderRadius: 4, overflow: 'hidden',
                      }}>
                        {thumb
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={thumb} alt={l.name} style={{ maxWidth: '90%', maxHeight: '90%' }} />
                          : <span style={{ fontSize: 10, color: ui.textFaint }}>{l.name?.[0] ?? '?'}</span>}
                      </span>
                      <span style={{ fontSize: 10.5, color: ui.textMuted, lineHeight: 1.2, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </BrandPopover>
        )}

        {colorMenuOpen && (
          <BrandPopover anchor="right" onClose={() => setColorMenuOpen(false)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, padding: 12 }}>
              {BRAND_PALETTES.map(p => {
                const isSel = brandPalette === p;
                return (
                  <button
                    key={p}
                    onClick={() => { setBrandPalette(p); setColorMenuOpen(false); }}
                    title={p}
                    style={{
                      width: 36, height: 36, padding: 0,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: `var(--bs-brand-colors-${p}-500)`,
                      border: `2px solid ${isSel ? ui.accent : 'transparent'}`,
                      boxShadow: `0 0 0 1px ${ui.panelLine}`,
                    }} />
                  </button>
                );
              })}
            </div>
          </BrandPopover>
        )}
      </div>
    </div>
  );
}

function BrandPopover({ children, anchor = 'left', onClose }) {
  // Lightweight click-outside backdrop. Positioned absolutely below the
  // triggering control inside the sidebar's relative wrapper.
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
      <div style={{
        position: 'absolute',
        top: '100%', marginTop: 8,
        [anchor === 'right' ? 'right' : 'left']: 0,
        minWidth: anchor === 'right' ? 240 : 320,
        background: ui.panel,
        border: `1px solid ${ui.panelLine}`,
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        zIndex: 60,
      }}>
        {children}
      </div>
    </>
  );
}

function ProjectFilesSection({
  project, files, allProjects, loading,
  selectedId, onSelect, onRequestAdd, onRemoveFile,
  onMoveFile, onDeletePattern, onRenamePattern,
}) {
  const otherProjects = (allProjects || []).filter(p => p.id !== project.id);
  const buildMenu = (f) => [
    { label: 'Rename', onClick: () => onRenamePattern?.(f.id, f.slug) },
    {
      label: 'Move to project',
      submenu: otherProjects.map(p => ({
        label: p.name,
        onClick: () => onMoveFile?.({
          projectFileId: f.projectFileId,
          corpusEntryId: f.id,
          targetProjectId: p.id,
        }),
      })),
    },
    {
      label: 'Remove from project',
      onClick: () => onRemoveFile?.(f.projectFileId),
    },
    { divider: true },
    {
      label: 'Delete pattern',
      destructive: true,
      onClick: () => onDeletePattern?.(f.id),
    },
  ];

  return (
    <div style={{ padding: '8px 12px', position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 8px 8px',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
          color: ui.textFaint, textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {project.name} ({files.length})
        </div>
        <button
          onClick={onRequestAdd}
          aria-label="Add file to project"
          title="Browse Brandsync Make to add a file"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px',
            background: ui.bg, color: ui.textMuted,
            border: `1px solid ${ui.panelLine}`,
            borderRadius: 6, cursor: 'pointer', fontSize: 11,
            fontFamily: 'inherit',
          }}
        >
          <Plus size={10} weight="bold" />
          Add
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '12px 8px', fontSize: 12, color: ui.textMuted }}>
          Loading files…
        </div>
      ) : files.length === 0 ? (
        <div style={{
          padding: '20px 14px',
          background: ui.bg,
          border: `1px dashed ${ui.panelLine}`,
          borderRadius: 8,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 12.5, color: ui.text, fontWeight: 500, marginBottom: 4 }}>
            No files yet
          </div>
          <div style={{ fontSize: 11.5, color: ui.textMuted, lineHeight: 1.5, marginBottom: 12 }}>
            Head back to Brandsync Make to load a handoff or pick a pattern.
          </div>
          <button
            onClick={onRequestAdd}
            style={{
              padding: '6px 12px',
              background: ui.accent, color: ui.accentText,
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontSize: 11.5, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit',
            }}
          >
            <Plus size={10} weight="bold" />
            Add a file
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => (
            <PatternListItem
              key={f.projectFileId ?? f.id}
              pattern={f}
              selected={f.id === selectedId}
              onClick={() => onSelect(f.id)}
              menuItems={buildMenu(f)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Scrollable session transcript. Each turn renders as a stacked pair:
// the user's prompt (left-aligned bubble) followed by the assistant's
// response (muted, with model + context + token usage). Height is
// capped so it never pushes the input bar off-screen; new turns scroll
// the panel automatically.
function TranscriptView({ transcript, selected }) {
  const scrollerRef = useRef(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  if (!transcript?.length) {
    return (
      <div style={{ maxHeight: 180, fontSize: 12.5, lineHeight: 1.55, color: ui.textMuted, fontStyle: 'italic' }}>
        {selected
          ? <>Talk to Brandsync Make in the input below — every prompt + response will appear here.</>
          : <>No conversation yet. Describe a screen below to get started.</>}
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      style={{
        maxHeight: 180,
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 12,
        paddingRight: 4,
      }}
    >
      {transcript.map(turn => <TranscriptTurn key={turn.id} turn={turn} />)}
    </div>
  );
}

function TranscriptTurn({ turn }) {
  const { prompt, status, response, editingSlug } = turn;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* User prompt */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: ui.textFaint, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>You</div>
        <div style={{
          fontSize: 12.5, lineHeight: 1.5, color: ui.text,
          background: ui.pill,
          border: `1px solid ${ui.pillBorder}`,
          borderRadius: 8,
          padding: '8px 10px',
          wordBreak: 'break-word',
        }}>
          {prompt}
          {editingSlug && (
            <div style={{ fontSize: 10.5, color: ui.textMuted, marginTop: 4 }}>
              editing <code style={{ background: ui.bg, padding: '0 4px', borderRadius: 3 }}>{editingSlug}</code>
            </div>
          )}
        </div>
      </div>

      {/* Assistant response */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: ui.textFaint, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>Brandsync Make</div>
        <div style={{
          fontSize: 12, lineHeight: 1.55, color: ui.textMuted,
          padding: '4px 2px',
        }}>
          {status === 'pending' && (
            <span style={{ fontStyle: 'italic' }}>Thinking…</span>
          )}
          {status === 'error' && (
            <span style={{ color: '#9b1c1c' }}>Failed: {response?.error}</span>
          )}
          {status === 'ok' && response && <TurnSummary response={response} />}
        </div>
      </div>
    </div>
  );
}

function TurnSummary({ response }) {
  const { slug, edited, model, contextUsed = '', usage } = response;
  const refsMatch = contextUsed.match(/reference[^()]*\(([^)]+)\)/);
  const refs = refsMatch
    ? refsMatch[1].split(',').map(s => s.trim().replace(/^corpus\/patterns\//, '').replace(/\.md$/, ''))
    : [];
  const projectMatch = contextUsed.match(/(\d+) project file/);
  const projectFiles = projectMatch ? Number(projectMatch[1]) : 0;

  const codeStyle = {
    background: ui.pill, padding: '0 5px', borderRadius: 3,
    fontSize: 11, fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    color: ui.text,
  };

  return (
    <>
      <div>
        {edited ? 'Updated ' : 'Generated '}
        <code style={codeStyle}>{slug}</code>
        {' '}using <code style={codeStyle}>{model}</code>
      </div>
      <div style={{ fontSize: 11, color: ui.textFaint, marginTop: 3 }}>
        Context: components + tokens
        {projectFiles > 0 && ` + ${projectFiles} project file${projectFiles === 1 ? '' : 's'}`}
        {refs.length > 0 && (
          <>
            {' · '}refs {refs.map((r, i) => (
              <span key={r}>
                <code style={codeStyle}>{r}</code>{i < refs.length - 1 ? ', ' : ''}
              </span>
            ))}
          </>
        )}
        {usage && (
          <> · {(usage.prompt_tokens ?? 0).toLocaleString()} in / {(usage.completion_tokens ?? 0).toLocaleString()} out{usage.total_time ? ` · ${usage.total_time.toFixed(1)}s` : ''}</>
        )}
      </div>
    </>
  );
}

function DesignSystemToggle({ enabled, onToggle, fileCount }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={enabled}
      title={enabled
        ? "Generation uses your project's components — fewer MCP calls, lower tokens."
        : "Turn on to bake your project's components into the prompt and skip MCP lookups."}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px',
        background: enabled ? 'var(--bs-color-accent-container)' : 'transparent',
        color: enabled ? 'var(--bs-color-accent-default)' : ui.textMuted,
        border: `1px solid ${enabled ? 'var(--bs-color-accent-default)' : ui.panelLine}`,
        borderRadius: 999,
        fontSize: 12, fontWeight: enabled ? 600 : 500,
        lineHeight: 1, cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
      }}
    >
      <Cube size={13} weight={enabled ? 'fill' : 'regular'} />
      <span>My UI Kit</span>
      {enabled && fileCount != null && (
        <span style={{ fontSize: 11, opacity: 0.65 }}>· {fileCount}</span>
      )}
    </button>
  );
}

function LeftSidebar({
  patterns, activeProject, allProjects, projectFilesLoading,
  onRequestAddToProject, onRemoveFileFromProject,
  onMoveFileToProject, onDeletePattern, onRenamePattern,
  selectedId, onSelect, prompt, onPromptChange,
  selectedLogo, onPickLogo, logoMenuOpen, setLogoMenuOpen,
  logos, logosLoading, onEnsureLogosLoaded,
  brandPalette, setBrandPalette, colorMenuOpen, setColorMenuOpen,
  useDesignSystem, onUseDesignSystemChange,
  onSend, generating, generateError, onClearGenerateError,
  transcript,
}) {
  const selected = patterns.find(p => p.id === selectedId);
  const inProject = Boolean(activeProject);
  return (
    <aside style={{
      width: 320, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: ui.panel,
      borderRight: `1px solid ${ui.panelLine}`,
      color: ui.text,
    }}>
      <BrandSection
        selectedLogo={selectedLogo}
        onPickLogo={onPickLogo}
        logoMenuOpen={logoMenuOpen}
        setLogoMenuOpen={setLogoMenuOpen}
        logos={logos}
        logosLoading={logosLoading}
        onEnsureLogosLoaded={onEnsureLogosLoaded}
        brandPalette={brandPalette}
        setBrandPalette={setBrandPalette}
        colorMenuOpen={colorMenuOpen}
        setColorMenuOpen={setColorMenuOpen}
      />

      {/* Header pill: project name when one is active (the files below
          belong to it); selected pattern slug otherwise. */}
      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{
          ...pillStyle, padding: '8px 14px',
          background: ui.pill,
          width: 'fit-content', maxWidth: '100%',
          textTransform: inProject ? 'none' : 'capitalize', fontWeight: 500,
        }}>
          {inProject
            ? activeProject.name
            : (selected ? selected.slug.replace(/-/g, ' ') : 'Design something…')}
        </div>
      </div>

      {/* Patterns list (or project files when a project is active) */}
      {inProject ? (
        <ProjectFilesSection
          project={activeProject}
          files={patterns}
          allProjects={allProjects}
          loading={projectFilesLoading}
          selectedId={selectedId}
          onSelect={onSelect}
          onRequestAdd={onRequestAddToProject}
          onRemoveFile={onRemoveFileFromProject}
          onMoveFile={onMoveFileToProject}
          onDeletePattern={onDeletePattern}
          onRenamePattern={onRenamePattern}
        />
      ) : (
        <div style={{ padding: '8px 12px' }}>
          <div style={{
            padding: '10px 8px 8px',
            fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
            color: ui.textFaint, textTransform: 'uppercase',
          }}>My Patterns ({patterns.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {patterns.map(p => (
              <PatternListItem
                key={p.id}
                pattern={p}
                selected={p.id === selectedId}
                onClick={() => onSelect(p.id)}
                menuItems={[
                  { label: 'Rename', onClick: () => onRenamePattern?.(p.id, p.slug) },
                  { divider: true },
                  { label: 'Delete pattern', destructive: true, onClick: () => onDeletePattern(p.id) },
                ]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Session transcript — chat-style log of every prompt + response */}
      <div style={{
        padding: '16px 20px',
        borderTop: `1px solid ${ui.panelLine}`,
        marginTop: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
          color: ui.textFaint, textTransform: 'uppercase', marginBottom: 10,
        }}>Reasoning</div>
        <TranscriptView transcript={transcript} selected={selected} />
      </div>

      <div style={{ flex: 1 }} />

      {generateError && (
        <div style={{
          margin: '0 16px 0',
          padding: '8px 12px',
          background: '#fdecec',
          border: '1px solid #f3b9b9',
          borderRadius: 8,
          fontSize: 12,
          color: '#9b1c1c',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>
            <strong>Generation failed.</strong> {generateError}
          </span>
          <button
            onClick={onClearGenerateError}
            aria-label="Dismiss"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#9b1c1c', fontSize: 14, lineHeight: 1, padding: 0,
              fontFamily: 'inherit',
            }}
          >×</button>
        </div>
      )}

      {/* Message input at bottom */}
      <div style={{ padding: 16 }}>
        <div style={{
          background: ui.bg,
          border: `1px solid ${ui.panelLine}`,
          borderRadius: 12,
          padding: 12,
        }}>
          <input
            value={prompt}
            onChange={e => onPromptChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && prompt.trim() && !generating) {
                e.preventDefault();
                onSend?.();
              }
            }}
            disabled={generating}
            placeholder={generating ? 'Generating…' : 'Describe a screen or a change'}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'transparent', border: 0, color: ui.text,
              outline: 'none', fontSize: 13, padding: '4px 6px',
              opacity: generating ? 0.5 : 1,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <DesignSystemToggle
              enabled={useDesignSystem}
              onToggle={() => onUseDesignSystemChange(!useDesignSystem)}
              fileCount={activeProject ? patterns.length : null}
            />
            <div style={{ flex: 1 }} />
            <span style={{ ...pillStyle, fontSize: 11, padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Default <CaretDown size={11} weight="bold" />
            </span>
            <button
              aria-label="Send"
              onClick={onSend}
              disabled={generating || !prompt.trim()}
              style={{
                width: 30, height: 30, borderRadius: 999,
                background: ui.accent, color: ui.accentText,
                border: 0,
                cursor: (generating || !prompt.trim()) ? 'not-allowed' : 'pointer',
                opacity: (generating || !prompt.trim()) ? 0.45 : 1,
                display: 'grid', placeItems: 'center',
                transition: 'opacity 120ms ease',
              }}
            >
              {generating
                ? <CircleNotch size={14} weight="bold" style={{ animation: 'bs-spin 700ms linear infinite' }} />
                : <PaperPlaneRight size={14} weight="fill" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function CanvasPlaceholder({ message = 'Working out the details…' }) {
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', background: ui.canvas, color: ui.textMuted, padding: '48px 48px 72px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <div style={{
          width: 200, height: 120,
          border: `1px dashed ${ui.textFaint}`, borderRadius: 8,
          position: 'relative', color: ui.textFaint,
        }}>
          <span style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }}>
            <CaretDown size={14} weight="regular" />
          </span>
          <span style={{ position: 'absolute', top: 32, left: 28 }}>
            <Smiley size={22} weight="regular" />
          </span>
          <span style={{ position: 'absolute', top: 32, right: 28 }}>
            <House size={22} weight="regular" />
          </span>
          <span style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)' }}>
            <CircleNotch size={14} weight="regular" />
          </span>
        </div>
        <span style={{ fontSize: 13 }}>{message}</span>
      </div>
    </div>
  );
}

function SourceEditor({ pattern, edits, onEdit }) {
  const parsed = useMemo(() => parseSources(pattern.content), [pattern.content]);
  const html = edits?.html ?? parsed.html;
  const css  = edits?.css  ?? parsed.css;
  const js   = edits?.js   ?? parsed.js;

  // JS tab only renders if the pattern has any JS — either parsed from
  // source or freshly typed by the user.
  const hasJs = Boolean(js?.trim() || edits?.js != null);

  const TABS = [
    { key: 'html', label: 'index.html', value: html },
    { key: 'css',  label: 'styles.css', value: css },
    ...(hasJs ? [{ key: 'js', label: 'script.js', value: js }] : []),
  ];

  // Default to the first non-empty tab if HTML is empty (rare).
  const initialTab = TABS.find(t => t.value)?.key ?? 'html';
  const [activeKey, setActiveKey] = useState(initialTab);
  // If pattern changes, default tab back to first non-empty.
  useEffect(() => { setActiveKey(initialTab); }, [pattern.id, initialTab]);

  const active = TABS.find(t => t.key === activeKey) ?? TABS[0];
  const lineCount = (active.value || '').split('\n').length;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
      background: ui.canvas, padding: '32px 48px 32px',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: '#0d1117',
        border: '1px solid #1f2733',
        borderRadius: 12, overflow: 'hidden',
        flex: 1, minHeight: 0,
        maxWidth: 1100, width: '100%', margin: '0 auto',
        boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex', alignItems: 'stretch',
          background: '#0a0e14',
          borderBottom: '1px solid #1f2733',
        }}>
          {TABS.map(t => {
            const isActive = t.key === activeKey;
            return (
              <button
                key={t.key}
                onClick={() => setActiveKey(t.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px',
                  background: isActive ? '#0d1117' : 'transparent',
                  color: isActive ? '#e6edf3' : '#7d8590',
                  border: 'none',
                  borderRight: '1px solid #1f2733',
                  borderBottom: isActive ? 'none' : '1px solid #1f2733',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 500,
                  fontFamily: 'inherit',
                  position: 'relative',
                  top: isActive ? 1 : 0,
                  marginBottom: isActive ? -1 : 0,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: t.key === 'html' ? '#e34c26'
                            : t.key === 'css'  ? '#3b8eea'
                            :                    '#f0db4f',
                }} />
                {t.label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{
            padding: '10px 16px',
            fontSize: 11, color: '#7d8590',
            fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
          }}>
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </div>
        </div>

        {/* Editable area — Monaco (the editor that powers VS Code) */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <MonacoEditor
            height="100%"
            theme="vs-dark"
            language={active.key === 'js' ? 'javascript' : active.key}
            path={`pattern-${pattern.id}.${active.key === 'js' ? 'js' : active.key}`}
            value={active.value}
            onChange={(val) => onEdit(active.key, val ?? '')}
            options={{
              fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
              fontSize: 13,
              lineHeight: 1.6,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
              renderLineHighlight: 'all',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              padding: { top: 16, bottom: 16 },
              automaticLayout: true,
              formatOnPaste: true,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Canvas({
  pattern, tokensCss, mode, viewport, theme, brandPalette, selectedLogo,
  onViewportChange, onThemeChange,
  edits, onEdit,
}) {
  // Head (tokens + brand override + font/icon links) is stable while
  // editing. Memoize separately so Monaco keystrokes only re-build the
  // ~few hundred char body half instead of re-concating tokens.css.
  const head = useMemo(
    () => buildPreviewHead(tokensCss, theme, brandPalette),
    [tokensCss, theme, brandPalette],
  );
  const preview = useMemo(
    () => pattern ? buildPreviewDoc(pattern.content, tokensCss, theme, brandPalette, selectedLogo, edits, head) : null,
    [pattern, tokensCss, theme, brandPalette, selectedLogo, edits, head],
  );
  const vp = VIEWPORTS[viewport];
  const iframeBg = theme === 'light' ? '#ffffff' : '#191c22';

  if (!pattern) return <CanvasPlaceholder message="Select a pattern from the sidebar to preview." />;
  if (mode === 'source') {
    return (
      <SourceEditor
        pattern={pattern}
        edits={edits}
        onEdit={(key, value) => onEdit?.(pattern.id, key, value)}
      />
    );
  }
  if (!preview) return <CanvasPlaceholder message="No HTML/CSS blocks in this pattern." />;

  // Canvas scrolls when the chosen viewport doesn't fit; iframe stays at its
  // exact pixel size so the design renders at its target resolution.
  return (
    <div style={{
      flex: 1, background: ui.canvas, padding: '32px 48px 72px',
      overflow: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <CanvasControlBar
        viewport={viewport}
        onViewportChange={onViewportChange}
        theme={theme}
        onThemeChange={onThemeChange}
      />

      <div style={{
        width: vp.width, height: vp.height, flexShrink: 0,
        display: 'flex',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.08)',
        border: `1px solid ${ui.panelLine}`,
        background: iframeBg,
        transition: 'width 180ms ease, height 180ms ease, background 180ms ease',
      }}>
        <iframe
          title={`${pattern.slug} — ${vp.label} ${theme}`}
          srcDoc={preview}
          sandbox=""
          style={{
            width: '100%', height: '100%', border: 0, background: iframeBg,
          }}
        />
      </div>
    </div>
  );
}

// ───────────────────── page ─────────────────────

export default function MyPatternsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProjectId = searchParams.get('projectId');

  const [patterns, setPatterns] = useState([]);
  const [tokensCss, setTokensCss] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('preview'); // 'preview' | 'source'
  const [viewport, setViewport] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [theme, setTheme] = useState('dark');           // 'dark' | 'light'
  const [componentsDrawerOpen, setComponentsDrawerOpen] = useState(false);

  // Recent projects (for the TopBar switcher) + the files inside the
  // currently-active project (rendered in the sidebar instead of all
  // patterns when a project is selected).
  const [projects, setProjects] = useState([]);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectFiles, setProjectFiles] = useState([]);
  const [projectFilesLoading, setProjectFilesLoading] = useState(false);
  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  const fetchProjects = () =>
    fetch(`/api/projects?userEmail=${encodeURIComponent('vivka@eg.dk')}`)
      .then(r => r.json())
      .then(body => { setProjects(body.projects ?? []); })
      .catch(() => setProjects([]));

  useEffect(() => { fetchProjects(); }, []);

  // Reload project files whenever the active project changes.
  useEffect(() => {
    if (!activeProjectId) {
      setProjectFiles([]);
      return;
    }
    setProjectFilesLoading(true);
    fetch(`/api/projects/${activeProjectId}?userEmail=${encodeURIComponent('vivka@eg.dk')}`)
      .then(r => r.json())
      .then(body => setProjectFiles(body.files ?? []))
      .catch(() => setProjectFiles([]))
      .finally(() => setProjectFilesLoading(false));
  }, [activeProjectId]);

  // "+ Add" inside the project sends the user back to the Brandsync Make
  // landing page with ?projectId=… in the URL so the project stays
  // selected. The landing page picks that up and routes any chosen pattern
  // back into this project (or just returns to the workspace).
  const handleRequestAddToProject = () => {
    if (!activeProjectId) return;
    router.push(`/brandsync-make?projectId=${activeProjectId}`);
  };

  // When ON, prompt-bar generations should bake the project's components
  // + files into the prompt locally instead of letting Claude call MCP for
  // them. Wiring to the actual /api/generate endpoint comes next; for now
  // this just drives the toggle's visual state.
  const [useDesignSystem, setUseDesignSystem] = useState(true);

  // In-memory edits made in Source mode, keyed by pattern id. Edits flow
  // back into the preview iframe so users see their tweaks live. Lost on
  // page reload — persisting to corpus_entries is a follow-up.
  const [editedSources, setEditedSources] = useState({});
  const handleSourceEdit = (patternId, key, value) => {
    setEditedSources(prev => ({
      ...prev,
      [patternId]: { ...(prev[patternId] ?? {}), [key]: value },
    }));
  };

  // Generation state — wired to /api/generate (currently a 501 stub;
  // generations are driven from the Claude Code chat for now). Local
  // state updates on response so the new/edited pattern appears
  // immediately without a refetch.
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  // Session transcript — chronological chat log of every prompt and the
  // model's response metadata. Lives only in memory; cleared on reload.
  // Each turn: { id, prompt, at, status: 'pending' | 'ok' | 'error',
  //              response: { slug, edited, model, contextUsed, usage } | { error } }
  const [transcript, setTranscript] = useState([]);

  // When a file is selected the send modifies that file in place ("add a
  // logout button"). Otherwise it creates a new pattern. To start fresh
  // while a file is selected, use "+ Add" in the project files header or
  // click the Brandsync Make logo.

  const handleSend = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || generating) return;

    // Append a pending turn to the session transcript so the user sees
    // their message land + a spinner while the model is working.
    const turnId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now());
    const editingSlug = selectedId
      ? displayPatterns.find(p => p.id === selectedId)?.slug
      : null;
    setTranscript(prev => {
      const next = [...prev, {
        id: turnId,
        prompt: trimmed,
        at: new Date().toISOString(),
        status: 'pending',
        editingSlug,
      }];
      // Cap the in-memory log so a long session doesn't grow unbounded.
      return next.length > 50 ? next.slice(-50) : next;
    });

    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: 'vivka@eg.dk',
          prompt: trimmed,
          projectId: activeProjectId,
          useDesignSystem,
          theme,
          brandPalette,
          selectedLogoName: selectedLogo?.name,
          editEntryId: selectedId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      const updatedPattern = body.pattern;

      // Resolve the pending turn with the model's actual response metadata.
      setTranscript(prev => prev.map(t => t.id === turnId ? {
        ...t,
        status: 'ok',
        response: {
          slug: updatedPattern.slug,
          edited: !!body.edited,
          model: body.model,
          contextUsed: body.contextUsed,
          usage: body.usage,
        },
      } : t));

      if (body.edited) {
        // Same file id — replace in-place across all relevant lists.
        setPatterns(prev => prev.map(p => p.id === updatedPattern.id ? { ...p, content: updatedPattern.content } : p));
        setProjectFiles(prev => prev.map(f =>
          f.corpus_entry_id === updatedPattern.id ? { ...f, content: updatedPattern.content } : f,
        ));
        // Drop any in-memory source edits for this pattern so the new
        // server content shows up cleanly in Source view.
        setEditedSources(prev => {
          const next = { ...prev };
          delete next[updatedPattern.id];
          return next;
        });
        if (activeProjectId) fetchProjects(); // bump updated_at on sidebar
      } else {
        // New pattern — insert into global list, refetch project files
        // (for count + ordering) AND the project list (for updated_at).
        // The two fetches are independent so run them in parallel.
        setPatterns(prev => [updatedPattern, ...prev]);
        if (activeProjectId) {
          const [detail] = await Promise.all([
            fetch(`/api/projects/${activeProjectId}?userEmail=${encodeURIComponent('vivka@eg.dk')}`).then(r => r.json()),
            fetchProjects(),
          ]);
          setProjectFiles(detail.files ?? []);
        }
        setSelectedId(updatedPattern.id);
      }

      setPrompt('');
    } catch (e) {
      setGenerateError(e.message);
      setTranscript(prev => prev.map(t => t.id === turnId ? {
        ...t,
        status: 'error',
        response: { error: e.message },
      } : t));
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveFileFromProject = async (fileId) => {
    if (!activeProjectId) return;
    await fetch(`/api/projects/${activeProjectId}/files/${fileId}?userEmail=${encodeURIComponent('vivka@eg.dk')}`, {
      method: 'DELETE',
    });
    setProjectFiles(prev => prev.filter(f => f.id !== fileId));
    fetchProjects();
  };

  // Move a project file from the active project to a different project.
  // Two calls: add to target (no-op if it's already there) + remove the
  // current membership row. Pattern (corpus_entry) is untouched.
  const handleMoveFileToProject = async ({ projectFileId, corpusEntryId, targetProjectId }) => {
    if (!activeProjectId || !targetProjectId || activeProjectId === targetProjectId) return;
    const userEmail = 'vivka@eg.dk';
    await fetch(`/api/projects/${targetProjectId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, corpusEntryId }),
    });
    await fetch(`/api/projects/${activeProjectId}/files/${projectFileId}?userEmail=${encodeURIComponent(userEmail)}`, {
      method: 'DELETE',
    });
    setProjectFiles(prev => prev.filter(f => f.id !== projectFileId));
    fetchProjects();
  };

  // Permanently delete a pattern. corpus_entries.id is the PK; the
  // project_files FK cascades so any memberships go with it.
  const handleDeletePattern = async (patternId) => {
    if (!confirm('Delete this pattern? This removes it from every project and cannot be undone.')) return;
    const res = await fetch(`/api/my-patterns/${patternId}?userEmail=${encodeURIComponent('vivka@eg.dk')}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Delete failed: ${body.error || res.status}`);
      return;
    }
    setPatterns(prev => prev.filter(p => p.id !== patternId));
    setProjectFiles(prev => prev.filter(f => f.corpus_entry_id !== patternId));
    // Release any in-memory Source-mode edits for the deleted pattern.
    setEditedSources(prev => {
      if (!prev[patternId]) return prev;
      const { [patternId]: _, ...rest } = prev;
      return rest;
    });
    if (selectedId === patternId) setSelectedId(null);
    if (activeProjectId) fetchProjects(); // file_count may have dropped
  };

  // Rename a pattern's slug (its display name in the sidebar). Server
  // re-slugifies + checks for uniqueness, so we can pass the raw user
  // input. window.prompt is intentionally minimal — swap for an inline
  // input later.
  const handleRenamePattern = async (patternId, currentSlug) => {
    const next = window.prompt('Rename pattern', currentSlug || '');
    if (next == null) return; // user cancelled
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentSlug) return;

    const res = await fetch(`/api/my-patterns/${patternId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: 'vivka@eg.dk', slug: trimmed }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(body.error || `Rename failed (${res.status})`);
      return;
    }
    const newSlug = body.pattern.slug;
    setPatterns(prev => prev.map(p => p.id === patternId ? { ...p, slug: newSlug } : p));
    setProjectFiles(prev => prev.map(f => f.corpus_entry_id === patternId ? { ...f, slug: newSlug } : f));
  };

  const handleSwitchProject = (id) => {
    setProjectMenuOpen(false);
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (id) params.set('projectId', id);
    else params.delete('projectId');
    const qs = params.toString();
    router.replace(`/brandsync-make/my-patterns${qs ? `?${qs}` : ''}`);
  };

  const handleCreateProject = async (name) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: 'vivka@eg.dk', name }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
    setProjects(prev => [{ ...body.project }, ...prev]);
    handleSwitchProject(body.project.id);
  };

  // Project-level brand identity. Logo + brand color palette. Logo comes from
  // the existing Strapi-proxied product-logos API. Palette is one of the
  // BRAND_PALETTES; when set, --bs-brand-* is overridden in pattern iframes.
  const [logos, setLogos] = useState([]);
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);
  const [logosLoading, setLogosLoading] = useState(false);
  const [brandPalette, setBrandPalette] = useState('blue');
  const [colorMenuOpen, setColorMenuOpen] = useState(false);

  const [logosError, setLogosError] = useState(null);

  // Lazy-load logos on first sidebar interaction. Avoids hitting Strapi at
  // page load when no one needs it yet.
  const ensureLogosLoaded = () => {
    if (logos.length > 0 || logosLoading) return;
    setLogosLoading(true);
    setLogosError(null);
    fetch('/api/product-logos?pageSize=100')
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        return body;
      })
      .then(({ data }) => {
        const arr = Array.isArray(data) ? data : [];
        setLogos(arr);
        if (arr.length === 0) {
          setLogosError('Prod API returned no logos.');
          return;
        }
        // Auto-select EG BrandSync on first load (when nothing is selected yet)
        // so the workspace shows a brand identity right away. Falls back to the
        // first logo if Brandsync is missing for any reason.
        setSelectedLogo(prev => {
          if (prev) return prev;
          const brandsync = arr.find(l => /brandsync/i.test(l.name ?? ''));
          return brandsync ?? arr[0];
        });
      })
      .catch(err => {
        setLogos([]);
        setLogosError(err?.message ?? String(err));
      })
      .finally(() => setLogosLoading(false));
  };

  // Eager logo fetch so the workspace boots with a brand identity already
  // selected (EG BrandSync by default) instead of an empty picker.
  useEffect(() => {
    ensureLogosLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Local-dev identity. Swap for Keycloak session / Supabase auth
    // before any non-local deploy — every `'vivka@eg.dk'` literal in
    // this file is a swap point.
    const userEmail = 'vivka@eg.dk';

    Promise.all([
      fetch(`/api/my-patterns?userEmail=${encodeURIComponent(userEmail)}`).then(r => r.json()),
      fetch('/brandsync-tokens.css').then(r => r.text()),
    ])
      .then(([data, css]) => {
        if (data.error) throw new Error(data.error);
        const ps = data.patterns ?? [];
        setPatterns(ps);
        setTokensCss(css);
        if (ps.length > 0) setSelectedId(ps[0].id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // When a project is active, the sidebar + canvas show files inside that
  // project. Files reference corpus_entries, so we reshape them into the
  // same { id, slug, type, content, … } shape patterns use. Outside a
  // project we fall back to the global "My Patterns" list.
  const displayPatterns = useMemo(() => {
    if (!activeProjectId) return patterns;
    return projectFiles.map(f => ({
      id: f.corpus_entry_id,
      projectFileId: f.id,
      slug: f.slug,
      type: f.type,
      content: f.content,
      created_by_email: undefined,
      created_by_name: undefined,
    }));
  }, [activeProjectId, projectFiles, patterns]);

  // Keep selectedId valid when displayPatterns changes (e.g. switching
  // projects, adding/removing files).
  useEffect(() => {
    if (displayPatterns.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!displayPatterns.find(p => p.id === selectedId)) {
      setSelectedId(displayPatterns[0].id);
    }
  }, [displayPatterns, selectedId]);

  const selected = displayPatterns.find(p => p.id === selectedId);
  const title = selected
    ? selected.slug.replace(/-/g, ' ')
    : (activeProject ? activeProject.name : 'My Patterns');

  return (
    <div style={{
      // Sit inside the brandsync-make layout (which already has site header
      // 64px + footer below us). Take the available height between them,
      // not the whole viewport — that way the global footer is reachable.
      height: 'calc(100vh - 64px)',
      background: ui.bg,
      color: ui.text,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes bs-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' }} />
      <TopBar
        title={title}
        mode={mode}
        onModeChange={setMode}
        onOpenComponents={() => setComponentsDrawerOpen(true)}
        onGoHome={() => router.push('/brandsync-make')}
        projects={projects}
        activeProject={activeProject}
        projectMenuOpen={projectMenuOpen}
        setProjectMenuOpen={setProjectMenuOpen}
        onSwitchProject={handleSwitchProject}
        onCreateProject={handleCreateProject}
      />

      <ComponentsDrawer
        open={componentsDrawerOpen}
        onClose={() => setComponentsDrawerOpen(false)}
        workspaceTheme={theme}
        brandPalette={brandPalette}
        selectedLogo={selectedLogo}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <LeftSidebar
          patterns={displayPatterns}
          activeProject={activeProject}
          allProjects={projects}
          projectFilesLoading={projectFilesLoading}
          onRequestAddToProject={handleRequestAddToProject}
          onRemoveFileFromProject={handleRemoveFileFromProject}
          onMoveFileToProject={handleMoveFileToProject}
          onDeletePattern={handleDeletePattern}
          onRenamePattern={handleRenamePattern}
          useDesignSystem={useDesignSystem}
          onUseDesignSystemChange={setUseDesignSystem}
          onSend={handleSend}
          generating={generating}
          generateError={generateError}
          onClearGenerateError={() => setGenerateError(null)}
          transcript={transcript}
          selectedId={selectedId}
          onSelect={setSelectedId}
          prompt={prompt}
          onPromptChange={setPrompt}
          selectedLogo={selectedLogo}
          onPickLogo={setSelectedLogo}
          logoMenuOpen={logoMenuOpen}
          setLogoMenuOpen={setLogoMenuOpen}
          logos={logos}
          logosLoading={logosLoading}
          onEnsureLogosLoaded={ensureLogosLoaded}
          brandPalette={brandPalette}
          setBrandPalette={setBrandPalette}
          colorMenuOpen={colorMenuOpen}
          setColorMenuOpen={setColorMenuOpen}
        />

        {loading ? (
          <CanvasPlaceholder message="Loading patterns from Supabase…" />
        ) : error ? (
          <CanvasPlaceholder message={`Error: ${error}`} />
        ) : (
          <Canvas
            pattern={selected}
            tokensCss={tokensCss}
            mode={mode}
            viewport={viewport}
            onViewportChange={setViewport}
            theme={theme}
            onThemeChange={setTheme}
            brandPalette={brandPalette}
            selectedLogo={selectedLogo}
            edits={selected ? editedSources[selected.id] : null}
            onEdit={handleSourceEdit}
          />
        )}
      </div>
    </div>
  );
}
