'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Code,
  ArrowsClockwise,
  Desktop,
  DeviceTablet,
  DeviceMobile,
  Gear,
  Sun,
  Moon,
  CaretDown,
} from '@phosphor-icons/react';
import { getComponentsForSidebar } from '@/api/design-system/component-list';
import { getComponentByName } from '@/api/design-system/components';

// ─────────────────────────── viewport presets ───────────────────────────

const VIEWPORTS = {
  desktop: { label: 'Desktop', width: 1280, height: 800, icon: Desktop },
  tablet:  { label: 'Tablet',  width: 768,  height: 1024, icon: DeviceTablet },
  mobile:  { label: 'Mobile',  width: 375,  height: 812,  icon: DeviceMobile },
};

// ─────────────────────────── code-blob parsing ───────────────────────────
// Strapi `components` rows store each variant's full HTML+CSS+JS as one blob
// inside a CodeExamples array entry. Split it into parts so we can stitch a
// clean iframe document.
function parseCodeParts(code = '') {
  const cssMatch = code.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const jsMatch  = code.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  return {
    html: code.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim(),
    css:  cssMatch ? cssMatch[1].trim() : '',
    js:   jsMatch  ? jsMatch[1].trim()  : '',
  };
}

function buildPreviewDoc({ html, css, js }, tokensCss, theme) {
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400;500;700;900&display=swap">
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css">
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css">
    <style>${tokensCss}</style>
    <style>
      html, body { margin: 0; padding: 0; background: var(--bs-surface-base); color: var(--bs-text-default); font-family: var(--bs-typography-font-family-body), system-ui, sans-serif; min-height: 100vh; display: grid; place-items: center; padding: 32px; box-sizing: border-box; }
      html, body { scrollbar-width: none; -ms-overflow-style: none; }
      html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
      ${css}
    </style>
  </head>
  <body>
    ${html}
    ${js ? `<script>${js}</script>` : ''}
  </body>
</html>`;
}

// ─────────────────────────── shell tokens ───────────────────────────

const ui = {
  bg: '#f5f6f8', canvas: '#eceef2', panel: '#ffffff', panelLine: '#e4e6eb',
  text: '#15181d', textMuted: '#5d6470', textFaint: '#9097a3',
  pill: '#f3f4f7', pillBorder: '#e0e3e9', accent: '#1a1d23', accentText: '#ffffff',
};

const pillStyle = {
  display: 'inline-flex', alignItems: 'center',
  background: ui.pill, color: ui.text,
  border: `1px solid ${ui.pillBorder}`,
  borderRadius: 999, padding: '3px 10px', fontSize: 12, lineHeight: 1,
};

function IconButton({ icon: Icon, label, onClick, active }) {
  return (
    <button
      onClick={onClick} aria-label={label} title={label}
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

function PillGroup({ children }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      background: ui.panel, borderRadius: 8, border: `1px solid ${ui.panelLine}`,
      padding: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>{children}</div>
  );
}

// ─────────────────────────── top bar ───────────────────────────

function TopBar({ title, mode, onModeChange }) {
  return (
    <header style={{
      height: 56, display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 20px', background: ui.panel,
      borderBottom: `1px solid ${ui.panelLine}`, color: ui.text, fontSize: 13,
    }}>
      <div style={{ width: 22, height: 22, borderRadius: 4, background: 'linear-gradient(135deg,#f04 0%,#a0f 50%,#0af 100%)' }} />
      <span style={{ fontWeight: 500 }}>{title}</span>
      <span style={{ ...pillStyle, fontSize: 10, padding: '2px 7px' }}>Library</span>
      <div style={{ flex: 1 }} />
      <IconButton active={mode === 'preview'} onClick={() => onModeChange('preview')} label="Preview" icon={Eye} />
      <IconButton active={mode === 'source'}  onClick={() => onModeChange('source')}  label="Source"  icon={Code} />
      <IconButton label="Refresh" icon={ArrowsClockwise} />
      <div style={{ flex: 1 }} />
      <IconButton label="Settings" icon={Gear} />
    </header>
  );
}

// ─────────────────────────── canvas controls ───────────────────────────

function CanvasControlBar({ viewport, onViewportChange, theme, onThemeChange }) {
  const vp = VIEWPORTS[viewport];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
      <PillGroup>
        {Object.entries(VIEWPORTS).map(([key, def]) => (
          <IconButton key={key} active={viewport === key} onClick={() => onViewportChange(key)} label={def.label} icon={def.icon} />
        ))}
        <span style={{
          padding: '0 12px 0 10px', fontSize: 11, color: ui.textMuted,
          fontFamily: 'ui-monospace, Menlo, Consolas, monospace', whiteSpace: 'nowrap',
        }}>{vp.width} × {vp.height}</span>
      </PillGroup>
      <PillGroup>
        <IconButton active={theme === 'light'} onClick={() => onThemeChange('light')} label="Light" icon={Sun} />
        <IconButton active={theme === 'dark'}  onClick={() => onThemeChange('dark')}  label="Dark"  icon={Moon} />
      </PillGroup>
    </div>
  );
}

// ─────────────────────────── sidebar ───────────────────────────

function ComponentListItem({ name, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', width: '100%',
        background: selected ? ui.pill : 'transparent',
        color: selected ? ui.text : ui.textMuted,
        border: `1px solid ${selected ? ui.pillBorder : 'transparent'}`,
        borderRadius: 10, padding: '10px 14px',
        fontSize: 13, cursor: 'pointer', fontWeight: 500,
      }}
    >{name}</button>
  );
}

function LeftSidebar({ items, selected, onSelect, loadingList }) {
  return (
    <aside style={{
      width: 280, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: ui.panel, borderRight: `1px solid ${ui.panelLine}`, color: ui.text,
    }}>
      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{ ...pillStyle, padding: '8px 14px', background: ui.pill, fontWeight: 500 }}>
          Brandsync Components
        </div>
      </div>
      <div style={{ padding: '8px 12px', flex: 1, overflow: 'auto' }}>
        <div style={{
          padding: '10px 8px 8px',
          fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
          color: ui.textFaint, textTransform: 'uppercase',
        }}>
          {loadingList ? 'Loading…' : `${items.length} components`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map(item => (
            <ComponentListItem
              key={item.id} name={item.title}
              selected={item.title === selected}
              onClick={() => onSelect(item.title)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────── canvas ───────────────────────────

function CanvasPlaceholder({ message = 'Pick a component to preview.' }) {
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', background: ui.canvas, color: ui.textMuted, padding: '48px 48px 72px' }}>
      <span style={{ fontSize: 13 }}>{message}</span>
    </div>
  );
}

function Canvas({ componentData, tokensCss, mode, viewport, theme, onViewportChange, onThemeChange, loadingDetail }) {
  const [activeVariant, setActiveVariant] = useState(0);

  // Extract variant blobs out of Strapi's `CodeExamples` field. The shape is
  // an array of items, each with at least one of size keys (Small/Medium/Large
  // or a flat `code` field) plus a `Variant` name.
  const variants = useMemo(() => {
    const raw = componentData?.CodeExamples;
    if (!raw || !Array.isArray(raw)) return [];
    return raw
      .map((v, i) => ({
        name: v.Variant || v.variant || `Variant ${i + 1}`,
        code: v.code || v.Code || v.MD || v.Small || v.Medium || v.Large || '',
      }))
      .filter(v => v.code);
  }, [componentData]);

  // Reset to first variant when component changes.
  useEffect(() => { setActiveVariant(0); }, [componentData?.Title]);

  const vp = VIEWPORTS[viewport];
  const iframeBg = theme === 'light' ? '#ffffff' : '#191c22';

  if (loadingDetail) return <CanvasPlaceholder message="Loading component…" />;
  if (!componentData) return <CanvasPlaceholder message="Pick a component from the sidebar." />;
  if (variants.length === 0) return <CanvasPlaceholder message="This component has no CodeExamples in Strapi yet." />;

  const current = variants[activeVariant] ?? variants[0];
  const parts = parseCodeParts(current.code);
  const srcDoc = buildPreviewDoc(parts, tokensCss, theme);

  if (mode === 'source') {
    return (
      <div style={{ flex: 1, overflow: 'auto', background: ui.canvas, padding: '32px 48px 72px' }}>
        <CanvasControlBar viewport={viewport} onViewportChange={onViewportChange} theme={theme} onThemeChange={onThemeChange} />
        <VariantTabs variants={variants} active={activeVariant} onChange={setActiveVariant} />
        <div style={{ background: ui.panel, color: ui.text, border: `1px solid ${ui.panelLine}`, borderRadius: 12, padding: 24, maxWidth: 980, margin: '20px auto 0' }}>
          <pre style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>{current.code}</pre>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, background: ui.canvas, padding: '32px 48px 72px', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <CanvasControlBar viewport={viewport} onViewportChange={onViewportChange} theme={theme} onThemeChange={onThemeChange} />
      <VariantTabs variants={variants} active={activeVariant} onChange={setActiveVariant} />
      <div style={{
        width: vp.width, height: vp.height, flexShrink: 0,
        display: 'flex', borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.08)',
        border: `1px solid ${ui.panelLine}`, background: iframeBg,
        marginTop: 20, transition: 'width 180ms ease, height 180ms ease, background 180ms ease',
      }}>
        <iframe title={`${componentData.Title} — ${current.name}`} srcDoc={srcDoc} sandbox="" style={{ width: '100%', height: '100%', border: 0, background: iframeBg }} />
      </div>
    </div>
  );
}

// ─────────────────────────── variant tabs ───────────────────────────

function VariantTabs({ variants, active, onChange }) {
  if (variants.length <= 1) return null;
  return (
    <div style={{
      display: 'inline-flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
      background: ui.panel, padding: 6, borderRadius: 10,
      border: `1px solid ${ui.panelLine}`, maxWidth: 880,
    }}>
      {variants.map((v, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
            background: active === i ? ui.accent : 'transparent',
            color: active === i ? ui.accentText : ui.textMuted,
            border: `1px solid ${active === i ? ui.accent : 'transparent'}`,
            fontFamily: 'inherit', fontWeight: 500,
          }}
        >{v.name}</button>
      ))}
    </div>
  );
}

// ─────────────────────────── page ───────────────────────────

export default function BrandsyncComponentsPage() {
  const [sidebarItems, setSidebarItems] = useState([]);
  const [selectedName, setSelectedName] = useState(null);
  const [componentData, setComponentData] = useState(null);
  const [tokensCss, setTokensCss] = useState('');
  const [mode, setMode] = useState('preview');
  const [viewport, setViewport] = useState('desktop');
  const [theme, setTheme] = useState('dark');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // Initial load: sidebar list + tokens CSS in parallel.
  useEffect(() => {
    Promise.all([
      getComponentsForSidebar(),
      fetch('/api/tokens').then(r => r.ok ? r.text() : ''),
    ])
      .then(([items, css]) => {
        if (items?.error) throw new Error(items.error);
        const list = Array.isArray(items) ? items : [];
        setSidebarItems(list);
        setTokensCss(css || '');
        if (list.length > 0) setSelectedName(list[0].title);
      })
      .catch(e => setError(e.message ?? 'Failed to load components from Strapi'))
      .finally(() => setLoadingList(false));
  }, []);

  // Detail fetch when selection changes.
  useEffect(() => {
    if (!selectedName) return;
    setLoadingDetail(true);
    getComponentByName(selectedName)
      .then(data => setComponentData(data?.error ? null : (data ?? null)))
      .finally(() => setLoadingDetail(false));
  }, [selectedName]);

  const title = componentData?.Title ?? selectedName ?? 'Components';

  return (
    <div style={{
      height: 'calc(100vh - 64px)',
      background: ui.bg, color: ui.text,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <TopBar title={title} mode={mode} onModeChange={setMode} />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <LeftSidebar
          items={sidebarItems}
          selected={selectedName}
          onSelect={setSelectedName}
          loadingList={loadingList}
        />

        {error ? (
          <CanvasPlaceholder message={`Error: ${error}. Is Strapi running at localhost:1337?`} />
        ) : (
          <Canvas
            componentData={componentData}
            tokensCss={tokensCss}
            mode={mode}
            viewport={viewport}
            theme={theme}
            onViewportChange={setViewport}
            onThemeChange={setTheme}
            loadingDetail={loadingDetail}
          />
        )}
      </div>
    </div>
  );
}
