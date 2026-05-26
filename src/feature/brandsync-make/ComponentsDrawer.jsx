'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Sun, Moon, MagnifyingGlass } from '@phosphor-icons/react';
import { brandOverrideCss, substituteBrand } from '@/lib/brand-substitute';
// We used to call getComponentsForSidebar/getComponentByName which proxied
// through the local Strapi at localhost:1337. Switched to /api/components
// which hits prod Strapi server-side via STRAPI_API_PROD_TOKEN — no local
// Strapi required, and CodeExamples are always populated (the local client
// excluded them in non-"dev" env).

// Right-side drawer that browses the Brandsync component library inline,
// without leaving the project workspace. Read-only for now: user previews
// a component + its variants, doesn't modify the project.

// ──────────────────────────────────────────────────────────────────────

function parseCodeParts(code = '') {
  const cssMatch = code.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const jsMatch  = code.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  return {
    html: code.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim(),
    css:  cssMatch ? cssMatch[1].trim() : '',
    js:   jsMatch  ? jsMatch[1].trim()  : '',
  };
}

// Components shipped from Strapi use hand-drawn Lucide-ish inline SVGs.
// We swap recognized icons for Phosphor web-font glyphs so previews use the
// official Brandsync icon set. Path signatures are stable across the 27
// components in the dump — see `node scripts/inspect-icons.mjs` for the full
// audit. Order matters: list specific signatures before generic ones.
const ICON_MAP = [
  // Chevrons / carets
  ['polyline points="9 18 15 12 9 6"',   'caret-right'],
  ['polyline points="6 9 12 15 18 9"',   'caret-down'],
  ['M6 4l4 4-4 4',                       'caret-right'],
  ['M7 4l6 6-6 6',                       'caret-right'],
  ['M13 4l-6 6 6 6',                     'caret-left'],

  // Status / actions
  ['M2 7l3.5 3.5L12 3',                  'check'],
  ['polyline points="20 6 9 17 4 12"',   'check'],
  ['M3 7h8',                             'minus'],
  ['line x1="18" y1="6" x2="6" y2="18"', 'x'],
  ['line x1="12" y1="5" x2="12" y2="19"','plus'],

  // Filesystem / content
  ['M22 19a2 2 0 0 1-2 2H4',             'folder'],
  ['polyline points="14 2 14 8 20 8"',   'file-text'],
  ['polyline points="3 6 5 6 21 6"',     'trash'],

  // Nav / shortcuts
  ['M3 12L12 4l9 8v8',                   'house'],
  ['M12 2l3.09 6.26L22 9.27',            'star'],
  ['polygon points="2,1 12,7 2,13"',     'play'],
  ['rect x="2" y="1" width="4" height="12" rx="1"', 'pause'],

  // Comms
  ['M18 8A6 6 0 0',                      'bell'],
  ['M6 1a3.5 3.5 0 0 0-3.5 3.5',         'bell'],
  ['M4 4h16c1.1',                        'envelope'],
  ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4', 'microphone'],

  // People
  ['circle cx="12" cy="8" r="4"',        'user'],

  // Feedback
  ['M10.29 3.86L1.82 18',                'warning'],
  ['9.09 9a3 3 0 0 1 5.83 1',            'question'],
  ['line x1="12" y1="16" x2="12.01" y2="16"', 'info'],
  ['line x1="12" y1="16" x2="12.01"',    'info'],

  // Misc
  ['M18 13v6a2 2 0 0 1-2 2H5',           'arrow-square-out'],
  ['M21 16V8a2 2 0 0 0-1-1.73',          'cube'],
  ['rect x="1" y="4" width="22" height="16" rx="2"', 'credit-card'],
  ['M21 10c0 7-9 13',                    'map-pin'],
  ['M7 11V7a5 5 0 0 1 10 0v4',           'lock'],
  ['M19.4 15a1.65 1.65',                 'gear'],
  ['M18.5 2.5a2.121',                    'pencil-simple'],
  ['rect x="3" y="3" width="18" height="18" rx="2" ry="2"', 'image'],
];

function replaceSvgsWithPhosphor(html) {
  return html.replace(/<svg([^>]*)>([\s\S]*?)<\/svg>/g, (match, attrs, inner) => {
    // Skip our progress spinners and avatar artwork — not really "icons".
    if (inner.includes('bs-progress-circular')) return match;
    if (/<ellipse\b/.test(inner)) return match; // avatar silhouettes
    // Skip SVGs that are component-internal artwork — they're sized,
    // positioned, and styled by the component's own CSS (checkbox tick,
    // radio dot, etc.). A `bs-*` class on the <svg> is the signal.
    // Replacing them with a Phosphor <i> would knock the component
    // layout off (checkbox tick wouldn't sit inside the box, etc.).
    if (/\bclass=["'][^"']*\bbs-[a-z0-9_-]+/i.test(attrs)) return match;

    const normalized = inner.replace(/\s+/g, ' ').trim();
    for (const [sig, name] of ICON_MAP) {
      if (normalized.includes(sig)) {
        // Anchor on word boundary so `width="16"` matches but
        // `stroke-width="2"` doesn't. Without this, snackbar's
        // <svg stroke-width="2" width="16"> rendered at font-size:2px.
        const widthMatch = attrs.match(/(?:^|\s)width=["'](\d+)/);
        const size = widthMatch ? widthMatch[1] : '16';
        return `<i class="ph ph-${name}" style="font-size:${size}px;line-height:1;display:inline-flex;vertical-align:middle"></i>`;
      }
    }
    return match;
  });
}

// Some Strapi-authored components (e.g. Navigation Drawer) use emoji as
// stand-in icons. Swap them for Phosphor glyphs so nav rows look native.
// Each entry handles both bare and VS16-suffixed (️) forms.
const EMOJI_MAP = [
  ['🏠', 'house'],       ['🏡', 'house'],
  ['📦', 'package'],
  ['🎨', 'palette'],
  ['📖', 'book-open'],   ['📚', 'books'],
  ['❓', 'question'],     ['❔', 'question'],
  ['⚙️', 'gear'],         ['⚙', 'gear'],
  ['🔔', 'bell'],
  ['⭐', 'star'],         ['🌟', 'star'],
  ['✅', 'check-circle'], ['☑️', 'check-square'],
  ['❌', 'x'],            ['✖️', 'x'],
  ['📁', 'folder'],       ['📂', 'folder-open'],
  ['📄', 'file'],         ['📝', 'note-pencil'],
  ['🔍', 'magnifying-glass'],
  ['🔧', 'wrench'],
  ['👤', 'user'],         ['👥', 'users'],
  ['📊', 'chart-bar'],    ['📈', 'chart-line-up'], ['📉', 'chart-line-down'],
  ['💬', 'chat'],
  ['📧', 'envelope'],     ['✉️', 'envelope'],
  ['🔒', 'lock'],         ['🔓', 'lock-open'],
  ['🔑', 'key'],
  ['🛒', 'shopping-cart'],
  ['🏷️', 'tag'],
  ['📅', 'calendar'],     ['📆', 'calendar-dots'],
  ['🚀', 'rocket'],
  ['⚡', 'lightning'],
  ['💡', 'lightbulb'],
  ['🔥', 'fire'],
  ['📷', 'camera'],       ['📸', 'camera'],
  ['🎥', 'video-camera'],
  ['📱', 'device-mobile'],
  ['💻', 'laptop'],
  ['🌍', 'globe'],        ['🌎', 'globe'], ['🌐', 'globe'],
  ['🗑️', 'trash'],        ['🗑', 'trash'],
  ['🎁', 'gift'],
  ['🎯', 'target'],
  ['📍', 'map-pin'],
  ['✏️', 'pencil-simple'], ['✏', 'pencil-simple'],
  ['🖼️', 'image'],         ['🖼', 'image'],
  ['ℹ️', 'info'],           ['ℹ', 'info'],
  ['⚠️', 'warning'],        ['⚠', 'warning'],
  ['🏆', 'trophy'],
  ['💼', 'briefcase'],
  ['🎵', 'music-note'],   ['🎶', 'music-notes'],
  ['🔊', 'speaker-high'], ['🔇', 'speaker-x'],
  ['👍', 'thumbs-up'],    ['👎', 'thumbs-down'],
  ['❤️', 'heart'],         ['🤍', 'heart'],
  ['👁️', 'eye'],
  ['🔄', 'arrows-clockwise'],
  ['↩️', 'arrow-u-up-left'],
  ['➕', 'plus'],          ['➖', 'minus'],
  ['🏢', 'building'],
];

function replaceEmojisWithPhosphor(html) {
  let out = html;
  for (const [emoji, name] of EMOJI_MAP) {
    if (!out.includes(emoji)) continue;
    const glyph = `<i class="ph ph-${name}" style="font-size:1.1em;line-height:1;display:inline-flex;vertical-align:middle"></i>`;
    out = out.split(emoji).join(glyph);
  }
  return out;
}

function buildPreviewDoc({ html, css, js }, tokensCss, theme, brandPalette, selectedLogo) {
  const themedHtml = replaceEmojisWithPhosphor(
    replaceSvgsWithPhosphor(substituteBrand(html, theme, selectedLogo)),
  );
  const brandCss = brandOverrideCss(brandPalette);
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400;500;700;900&display=swap">
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css">
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css">
    <style>${tokensCss}</style>
    ${brandCss ? `<style>${brandCss}</style>` : ''}
    <style>
      /* Top-align horizontally-centered content. Previously place-items:
         center vertically centered, which left a lot of empty space above
         short components (checkbox column floated mid-iframe). */
      html, body { margin: 0; padding: 0; background: var(--bs-surface-base); color: var(--bs-text-default); font-family: var(--bs-typography-font-family-body), system-ui, sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 48px 24px; box-sizing: border-box; gap: 24px; }
      /* Checkbox indeterminate fix — the component's SVG ships with
         inline style="opacity:0", which beats the component's own
         :indeterminate CSS rule. Use !important to win against inline. */
      .bs-checkbox input:indeterminate ~ .bs-checkbox__box .bs-icon-indeterminate { opacity: 1 !important; }
      .bs-checkbox input:indeterminate ~ .bs-checkbox__box .bs-icon-check       { opacity: 0 !important; }
      /* Several Strapi component SVGs draw dots as zero-length lines
         (e.g. info-icon top dot rendered as a same-point line). Without
         stroke-linecap=round those lines render as invisible butts.
         Force rounded caps on any component-internal SVG so the dots
         actually appear. */
      svg[class*="bs-"] { stroke-linecap: round; stroke-linejoin: round; }
      html, body { scrollbar-width: none; -ms-overflow-style: none; }
      html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
      img[src=""] { display: none; }
      /* Light-theme component preview sits on the workspace's canvas gray
         instead of pure white so component edges remain visible. Dark
         theme keeps its own surface-base (near-black). */
      html:not([data-theme="dark"]) body { background: #eceef2; }
      ${css}
    </style>
  </head>
  <body>${themedHtml}${js ? `<script>${js}</script>` : ''}
    <script>
      // Interactive shim — wires basic interactions for component previews.
      //
      // Accordion: shipped Strapi markup uses inline onclick handlers
      // with the wrong class names ("acc-item" / "open" instead of the
      // real "bs-acc-item" / "bs-open"); a delegated listener sidesteps it.
      //
      // Checkbox indeterminate: the :indeterminate CSS pseudo only matches
      // when JS sets input.indeterminate = true (no HTML attribute exists).
      // So any label whose text mentions "indeterminate" gets its input
      // pre-flagged here on init.
      document.addEventListener('click', function (e) {
        var header = e.target.closest && e.target.closest('.bs-acc-header');
        if (!header) return;
        var item = header.closest('.bs-acc-item');
        if (!item) return;
        var nowOpen = !item.classList.contains('bs-open');
        item.classList.toggle('bs-open', nowOpen);
        item.classList.toggle('bs-is-active', nowOpen);
        header.setAttribute('aria-expanded', String(nowOpen));
      });

      // Init pass for indeterminate checkboxes.
      document.querySelectorAll('.bs-checkbox').forEach(function (label) {
        if (!/indeterminate/i.test(label.textContent || '')) return;
        var input = label.querySelector('input[type=checkbox]');
        if (input) input.indeterminate = true;
      });
    </script>
  </body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────────

const ui = {
  bg: '#ffffff',
  panel: '#fafbfc',
  panelLine: '#e4e6eb',
  text: '#15181d',
  textMuted: '#5d6470',
  textFaint: '#9097a3',
  pill: '#f3f4f7',
  pillBorder: '#e0e3e9',
  accent: '#1a1d23',
  accentText: '#ffffff',
  backdrop: 'rgba(15, 18, 23, 0.32)',
};

// ──────────────────────────────────────────────────────────────────────
// Local component overrides
//
// A few prod Strapi components ship with hand-drawn icons, hardcoded
// "Brandsync" branding, or rough visual treatment. Where the corpus
// guidelines define the right look (see search_guidelines), we author a
// clean version locally and serve it instead — keeping the project's
// {{logo}} / {{product-name}} placeholders so the workspace's brand
// identity flows through.
//
// Keyed by the component Title (Strapi's primary id).

// Navigation Drawer follows the bs-* class convention from
// corpus/components/navigation-drawer.md but renders just the drawer +
// content (no top navigation header — that lives in its own component,
// "Navigation Header", below).
const NAV_DRAWER_PERSISTENT = `
<div class="bs-app-shell">
  <div class="bs-app-frame">
    <aside id="app-drawer" class="bs-nav-drawer" role="navigation" aria-label="Main navigation">
      <div class="bs-nav-brand">
        <img class="bs-nav-logo" src="{{logo}}" alt="{{product-name}}">
      </div>

      <div class="bs-nav-sections">
        <div class="bs-nav-section">
          <div class="bs-nav-section-label">Main</div>
          <a class="bs-nav-item bs-active" href="#" aria-current="page">
            <i class="ph ph-house bs-nav-icon"></i>
            <span>Dashboard</span>
          </a>
          <a class="bs-nav-item" href="#">
            <i class="ph ph-package bs-nav-icon"></i>
            <span>Components</span>
            <span class="bs-nav-badge">16</span>
          </a>
          <a class="bs-nav-item" href="#">
            <i class="ph ph-palette bs-nav-icon"></i>
            <span>Tokens</span>
          </a>
          <a class="bs-nav-item" href="#">
            <i class="ph ph-book-open bs-nav-icon"></i>
            <span>Guidelines</span>
          </a>
        </div>

        <div class="bs-nav-divider" role="separator"></div>

        <div class="bs-nav-section">
          <div class="bs-nav-section-label">Settings</div>
          <a class="bs-nav-item" href="#">
            <i class="ph ph-gear bs-nav-icon"></i>
            <span>Preferences</span>
          </a>
          <a class="bs-nav-item" href="#">
            <i class="ph ph-question bs-nav-icon"></i>
            <span>Help</span>
          </a>
        </div>
      </div>

      <div class="bs-nav-footer">
        <span class="bs-nav-footer-avatar">VK</span>
        <div class="bs-nav-footer-text">
          <div class="bs-nav-footer-name">Vignesh Kamath</div>
          <div class="bs-nav-footer-email">vivka@eg.dk</div>
        </div>
      </div>
    </aside>

    <main class="bs-app-content" aria-label="Page content">
      <h1>Dashboard</h1>
      <p>Persistent drawer paired with the navigation header — always visible on wider screens. Items are grouped under section labels for quick scanning.</p>
    </main>
  </div>
</div>

<style>
  .bs-app-shell {
    width: 100%;
    min-height: 460px;
    background: var(--bs-surface-base);
    color: var(--bs-text-default);
    font-family: var(--bs-typography-font-family-body), system-ui, sans-serif;
  }
  .bs-app-frame {
    display: grid;
    grid-template-columns: 264px 1fr;
    min-height: 460px;
  }
  .bs-nav-drawer {
    display: flex;
    flex-direction: column;
    background: var(--bs-surface-raised);
    border-right: 1px solid var(--bs-border-default);
  }
  .bs-nav-brand {
    display: flex;
    align-items: center;
    padding: var(--bs-spacing-250, 20px);
    border-bottom: 1px solid var(--bs-border-default);
  }
  .bs-nav-logo {
    max-width: 140px;
    max-height: 28px;
    object-fit: contain;
    object-position: left center;
  }
  .bs-nav-sections {
    flex: 1;
    padding: var(--bs-spacing-150, 12px) var(--bs-spacing-100, 8px);
    overflow-y: auto;
    display: flex; flex-direction: column;
    gap: 4px;
  }
  .bs-nav-section { display: flex; flex-direction: column; gap: 2px; }
  .bs-nav-section-label {
    padding: 10px 12px 6px;
    font-size: var(--bs-font-size-2xs, 11px);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bs-text-muted);
  }
  .bs-nav-item {
    display: flex;
    align-items: center;
    gap: var(--bs-spacing-150, 12px);
    padding: 9px 12px;
    border-radius: var(--bs-border-radius-100, 8px);
    font-size: var(--bs-font-size-sm, 14px);
    font-weight: 500;
    color: var(--bs-text-default);
    text-decoration: none;
    transition: background 120ms ease, color 120ms ease;
  }
  .bs-nav-item:hover { background: var(--bs-surface-hover); }
  .bs-nav-icon {
    font-size: 18px;
    color: var(--bs-icon-default, var(--bs-text-muted));
    flex-shrink: 0;
  }
  .bs-nav-item.bs-active {
    background: var(--bs-color-primary-container);
    color: var(--bs-color-primary-default);
    font-weight: 600;
  }
  .bs-nav-item.bs-active .bs-nav-icon { color: var(--bs-color-primary-default); }
  .bs-nav-badge {
    margin-left: auto;
    background: var(--bs-color-primary-default);
    color: var(--bs-text-on-action, #fff);
    font-size: 11px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 999px;
    line-height: 1.4;
  }
  .bs-nav-divider {
    height: 1px;
    background: var(--bs-border-default);
    margin: 8px 12px;
  }
  .bs-nav-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: var(--bs-spacing-150, 12px) var(--bs-spacing-200, 16px) var(--bs-spacing-200, 16px);
    border-top: 1px solid var(--bs-border-default);
  }
  .bs-nav-footer-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: var(--bs-color-primary-container);
    color: var(--bs-color-primary-default);
    display: grid; place-items: center;
    font-size: 12px; font-weight: 600;
    flex-shrink: 0;
  }
  .bs-nav-footer-text { min-width: 0; line-height: 1.25; }
  .bs-nav-footer-name {
    font-size: var(--bs-font-size-sm, 13px);
    font-weight: 600;
    color: var(--bs-text-default);
  }
  .bs-nav-footer-email {
    font-size: var(--bs-font-size-2xs, 11px);
    color: var(--bs-text-muted);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* ── Content ─────────────────────────────────────────────── */
  .bs-app-content { padding: var(--bs-spacing-400, 32px); }
  .bs-app-content h1 {
    margin: 0 0 var(--bs-spacing-150, 12px);
    font-size: var(--bs-font-size-xl, 22px);
    font-weight: 600;
  }
  .bs-app-content p {
    margin: 0;
    color: var(--bs-text-muted);
    font-size: var(--bs-font-size-sm, 13px);
    max-width: 48ch;
    line-height: 1.55;
  }
</style>
`.trim();

const NAV_DRAWER_TEMPORARY = `
<div class="bs-app-shell">
  <div class="bs-app-frame">
    <div class="bs-nav-overlay" aria-hidden="true"></div>

    <aside id="app-drawer" class="bs-nav-drawer bs-nav-drawer--temporary" role="dialog" aria-modal="true" aria-label="Main navigation">
      <div class="bs-drawer-header">
        <img class="bs-nav-logo" src="{{logo}}" alt="{{product-name}}">
        <button class="bs-close-btn" aria-label="Close menu">
          <i class="ph ph-x"></i>
        </button>
      </div>

      <div class="bs-nav-sections">
        <div class="bs-nav-section">
          <div class="bs-nav-section-label">Main</div>
          <a class="bs-nav-item bs-active" href="#" aria-current="page">
            <i class="ph ph-house bs-nav-icon"></i><span>Dashboard</span>
          </a>
          <a class="bs-nav-item" href="#">
            <i class="ph ph-package bs-nav-icon"></i><span>Components</span><span class="bs-nav-badge">16</span>
          </a>
          <a class="bs-nav-item" href="#">
            <i class="ph ph-palette bs-nav-icon"></i><span>Tokens</span>
          </a>
          <a class="bs-nav-item" href="#">
            <i class="ph ph-book-open bs-nav-icon"></i><span>Guidelines</span>
          </a>
        </div>
        <div class="bs-nav-divider" role="separator"></div>
        <div class="bs-nav-section">
          <div class="bs-nav-section-label">Settings</div>
          <a class="bs-nav-item" href="#"><i class="ph ph-gear bs-nav-icon"></i><span>Preferences</span></a>
          <a class="bs-nav-item" href="#"><i class="ph ph-question bs-nav-icon"></i><span>Help</span></a>
        </div>
      </div>
    </aside>

    <main class="bs-app-content" aria-label="Page content">
      <h1>Dashboard</h1>
      <p>Temporary drawer paired with the navigation header — overlays the page on smaller screens. The scrim closes the drawer when tapped.</p>
    </main>
  </div>
</div>

<style>
  .bs-app-shell {
    width: 100%;
    min-height: 460px;
    background: var(--bs-surface-base);
    color: var(--bs-text-default);
    font-family: var(--bs-typography-font-family-body), system-ui, sans-serif;
  }
  .bs-app-frame {
    position: relative;
    min-height: 460px;
  }
  .bs-nav-overlay {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.40);
    z-index: 1;
  }
  .bs-nav-drawer--temporary {
    position: absolute;
    top: 0; left: 0; bottom: 0;
    width: 280px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    background: var(--bs-surface-raised);
    box-shadow: var(--bs-shadow-elevation-md, 4px 0 24px rgba(0,0,0,0.18));
    border-right: 1px solid var(--bs-border-default);
  }
  .bs-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: var(--bs-spacing-200, 16px) var(--bs-spacing-150, 12px) var(--bs-spacing-150, 12px) var(--bs-spacing-250, 20px);
    border-bottom: 1px solid var(--bs-border-default);
  }
  .bs-nav-logo {
    max-width: 140px;
    max-height: 28px;
    object-fit: contain;
    object-position: left center;
  }
  .bs-close-btn {
    width: 32px; height: 32px;
    display: grid; place-items: center;
    background: transparent;
    border: none;
    border-radius: var(--bs-border-radius-100, 8px);
    cursor: pointer;
    color: var(--bs-text-default);
  }
  .bs-close-btn:hover { background: var(--bs-surface-hover); }
  .bs-close-btn i.ph { font-size: 16px; }

  .bs-nav-sections {
    flex: 1;
    padding: var(--bs-spacing-150, 12px) var(--bs-spacing-100, 8px);
    overflow-y: auto;
    display: flex; flex-direction: column;
    gap: 4px;
  }
  .bs-nav-section { display: flex; flex-direction: column; gap: 2px; }
  .bs-nav-section-label {
    padding: 10px 12px 6px;
    font-size: var(--bs-font-size-2xs, 11px);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bs-text-muted);
  }
  .bs-nav-item {
    display: flex; align-items: center;
    gap: var(--bs-spacing-150, 12px);
    padding: 9px 12px;
    border-radius: var(--bs-border-radius-100, 8px);
    font-size: var(--bs-font-size-sm, 14px);
    font-weight: 500;
    color: var(--bs-text-default);
    text-decoration: none;
    transition: background 120ms ease;
  }
  .bs-nav-item:hover { background: var(--bs-surface-hover); }
  .bs-nav-icon { font-size: 18px; color: var(--bs-icon-default, var(--bs-text-muted)); flex-shrink: 0; }
  .bs-nav-item.bs-active {
    background: var(--bs-color-primary-container);
    color: var(--bs-color-primary-default);
    font-weight: 600;
  }
  .bs-nav-item.bs-active .bs-nav-icon { color: var(--bs-color-primary-default); }
  .bs-nav-badge {
    margin-left: auto;
    background: var(--bs-color-primary-default);
    color: var(--bs-text-on-action, #fff);
    font-size: 11px; font-weight: 600;
    padding: 1px 8px; border-radius: 999px; line-height: 1.4;
  }
  .bs-nav-divider { height: 1px; background: var(--bs-border-default); margin: 8px 12px; }

  .bs-app-content { padding: var(--bs-spacing-400, 32px); }
  .bs-app-content h1 {
    margin: 0 0 var(--bs-spacing-150, 12px);
    font-size: var(--bs-font-size-xl, 22px);
    font-weight: 600;
  }
  .bs-app-content p {
    margin: 0;
    color: var(--bs-text-muted);
    font-size: var(--bs-font-size-sm, 13px);
    max-width: 48ch;
    line-height: 1.55;
  }
</style>
`.trim();

// ── Navigation Header — standalone top app bar ────────────────────────
// Pairs with the Navigation Drawer to make a full app shell. Uses the
// bs-app-header / bs-menu-btn / bs-header-title / bs-menu-bar classes
// from the navigation-drawer corpus entry.

const NAV_HEADER_DEFAULT = `
<div class="header-preview">
  <header class="bs-app-header" role="banner">
    <button class="bs-menu-btn" aria-label="Open main menu" aria-controls="app-drawer" aria-expanded="false">
      <i class="ph ph-list"></i>
    </button>

    <span class="bs-header-product">{{product-name}}</span>

    <div class="bs-header-divider" aria-hidden="true"></div>

    <div class="bs-header-title">Dashboard</div>

    <div class="bs-header-spacer"></div>

    <div class="bs-menu-bar" role="toolbar" aria-label="Header actions">
      <button class="bs-header-icon" aria-label="Search">
        <i class="ph ph-magnifying-glass"></i>
      </button>
      <button class="bs-header-icon" aria-label="Notifications">
        <i class="ph ph-bell"></i>
        <span class="bs-header-dot" aria-hidden="true"></span>
      </button>
      <button class="bs-header-icon" aria-label="Settings">
        <i class="ph ph-gear"></i>
      </button>
      <button class="bs-header-avatar" aria-label="Account menu">VK</button>
    </div>
  </header>
</div>

<style>
  .header-preview {
    width: 100%;
    padding: 24px;
    background: var(--bs-surface-base);
    color: var(--bs-text-default);
    font-family: var(--bs-typography-font-family-body), system-ui, sans-serif;
  }
  .bs-app-header {
    display: flex;
    align-items: center;
    gap: var(--bs-spacing-150, 12px);
    height: 56px;
    padding: 0 var(--bs-spacing-200, 16px);
    background: var(--bs-surface-raised);
    border: 1px solid var(--bs-border-default);
    border-radius: var(--bs-border-radius-150, 12px);
  }
  .bs-menu-btn {
    width: 36px; height: 36px;
    display: grid; place-items: center;
    background: transparent;
    border: none;
    border-radius: var(--bs-border-radius-100, 8px);
    color: var(--bs-text-default);
    cursor: pointer;
    transition: background 120ms ease;
  }
  .bs-menu-btn:hover { background: var(--bs-surface-hover); }
  .bs-menu-btn i.ph { font-size: 18px; }
  .bs-header-product {
    font-size: var(--bs-font-size-md, 15px);
    font-weight: 700;
    color: var(--bs-text-default);
    letter-spacing: -0.005em;
    padding: 0 4px;
  }
  .bs-header-divider {
    width: 1px;
    height: 24px;
    background: var(--bs-border-default);
  }
  .bs-header-title {
    font-size: var(--bs-font-size-md, 14px);
    font-weight: 500;
    color: var(--bs-text-muted);
  }
  .bs-header-spacer { flex: 1; }
  .bs-menu-bar { display: flex; align-items: center; gap: 4px; }
  .bs-header-icon {
    position: relative;
    width: 36px; height: 36px;
    display: grid; place-items: center;
    background: transparent;
    border: none;
    border-radius: var(--bs-border-radius-100, 8px);
    color: var(--bs-icon-default, var(--bs-text-muted));
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }
  .bs-header-icon:hover {
    background: var(--bs-surface-hover);
    color: var(--bs-text-default);
  }
  .bs-header-icon i.ph { font-size: 16px; }
  .bs-header-dot {
    position: absolute;
    top: 7px; right: 8px;
    width: 7px; height: 7px;
    background: var(--bs-color-primary-default);
    border: 2px solid var(--bs-surface-raised);
    border-radius: 50%;
  }
  .bs-header-avatar {
    width: 32px; height: 32px;
    margin-left: 6px;
    background: var(--bs-color-primary-container);
    color: var(--bs-color-primary-default);
    border: none;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: grid; place-items: center;
  }
</style>
`.trim();

const NAV_HEADER_WITH_SEARCH = `
<div class="header-preview">
  <header class="bs-app-header" role="banner">
    <button class="bs-menu-btn" aria-label="Open main menu" aria-controls="app-drawer" aria-expanded="false">
      <i class="ph ph-list"></i>
    </button>

    <span class="bs-header-product">{{product-name}}</span>

    <div class="bs-header-search">
      <i class="ph ph-magnifying-glass"></i>
      <input type="search" placeholder="Search across {{product-name}}…" aria-label="Search">
      <kbd class="bs-header-kbd">⌘K</kbd>
    </div>

    <div class="bs-menu-bar" role="toolbar" aria-label="Header actions">
      <button class="bs-header-icon" aria-label="Notifications">
        <i class="ph ph-bell"></i>
        <span class="bs-header-dot" aria-hidden="true"></span>
      </button>
      <button class="bs-header-avatar" aria-label="Account menu">VK</button>
    </div>
  </header>
</div>

<style>
  .header-preview {
    width: 100%;
    padding: 24px;
    background: var(--bs-surface-base);
    color: var(--bs-text-default);
    font-family: var(--bs-typography-font-family-body), system-ui, sans-serif;
  }
  .bs-app-header {
    display: flex;
    align-items: center;
    gap: var(--bs-spacing-150, 12px);
    height: 56px;
    padding: 0 var(--bs-spacing-200, 16px);
    background: var(--bs-surface-raised);
    border: 1px solid var(--bs-border-default);
    border-radius: var(--bs-border-radius-150, 12px);
  }
  .bs-menu-btn {
    width: 36px; height: 36px;
    display: grid; place-items: center;
    background: transparent;
    border: none;
    border-radius: var(--bs-border-radius-100, 8px);
    color: var(--bs-text-default);
    cursor: pointer;
    transition: background 120ms ease;
  }
  .bs-menu-btn:hover { background: var(--bs-surface-hover); }
  .bs-menu-btn i.ph { font-size: 18px; }
  .bs-header-product {
    font-size: var(--bs-font-size-md, 15px);
    font-weight: 700;
    color: var(--bs-text-default);
    letter-spacing: -0.005em;
    padding: 0 4px;
    white-space: nowrap;
  }
  .bs-header-search {
    flex: 1;
    max-width: 420px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 36px;
    background: var(--bs-surface-base);
    border: 1px solid var(--bs-border-default);
    border-radius: var(--bs-border-radius-100, 8px);
    transition: border-color 120ms ease;
  }
  .bs-header-search:focus-within {
    border-color: var(--bs-color-primary-default);
  }
  .bs-header-search i.ph {
    font-size: 14px;
    color: var(--bs-icon-default, var(--bs-text-muted));
  }
  .bs-header-search input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: var(--bs-font-size-sm, 13px);
    color: var(--bs-text-default);
    font-family: inherit;
  }
  .bs-header-search input::placeholder { color: var(--bs-text-muted); }
  .bs-header-kbd {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    color: var(--bs-text-muted);
    background: var(--bs-surface-raised);
    border: 1px solid var(--bs-border-default);
    border-radius: 4px;
    padding: 1px 5px;
  }
  .bs-menu-bar { display: flex; align-items: center; gap: 4px; margin-left: auto; }
  .bs-header-icon {
    position: relative;
    width: 36px; height: 36px;
    display: grid; place-items: center;
    background: transparent;
    border: none;
    border-radius: var(--bs-border-radius-100, 8px);
    color: var(--bs-icon-default, var(--bs-text-muted));
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }
  .bs-header-icon:hover {
    background: var(--bs-surface-hover);
    color: var(--bs-text-default);
  }
  .bs-header-icon i.ph { font-size: 16px; }
  .bs-header-dot {
    position: absolute;
    top: 7px; right: 8px;
    width: 7px; height: 7px;
    background: var(--bs-color-primary-default);
    border: 2px solid var(--bs-surface-raised);
    border-radius: 50%;
  }
  .bs-header-avatar {
    width: 32px; height: 32px;
    margin-left: 6px;
    background: var(--bs-color-primary-container);
    color: var(--bs-color-primary-default);
    border: none;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: grid; place-items: center;
  }
</style>
`.trim();

const LOCAL_COMPONENT_OVERRIDES = {
  'Navigation Drawer': [
    { Group: 'Persistent', Variant: null, Code: NAV_DRAWER_PERSISTENT },
    { Group: 'Temporary',  Variant: null, Code: NAV_DRAWER_TEMPORARY },
  ],
  'Navigation Header': [
    { Group: 'Default',     Variant: null, Code: NAV_HEADER_DEFAULT },
    { Group: 'With Search', Variant: null, Code: NAV_HEADER_WITH_SEARCH },
  ],
};

// Local-only components — surfaced in the sidebar list alongside the
// Strapi-fetched ones. Detail is served from LOCAL_COMPONENT_OVERRIDES
// without round-tripping to /api/components.
const LOCAL_COMPONENTS = [
  { id: 'local-navigation-header', title: 'Navigation Header', local: true },
];

// ──────────────────────────────────────────────────────────────────────

export default function ComponentsDrawer({
  open, onClose,
  // Defaults from the project workspace. The drawer lets the user override
  // theme locally, but mirrors the workspace's brand palette + logo so the
  // preview matches what they'll see in their pattern canvas.
  workspaceTheme = 'dark',
  brandPalette = 'blue',
  selectedLogo = null,
}) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [selectedName, setSelectedName] = useState(null);
  const [componentData, setComponentData] = useState(null);
  const [tokensCss, setTokensCss] = useState('');
  const [theme, setTheme] = useState(workspaceTheme);
  const [activeVariant, setActiveVariant] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // When the workspace toggles its theme, follow it — until the user
  // overrides locally via the drawer's toggle (the next render after their
  // click will keep their choice because workspaceTheme didn't change).
  useEffect(() => { setTheme(workspaceTheme); }, [workspaceTheme]);

  // First-mount fetch: list + tokens. Held until drawer opens at least once,
  // then cached for the rest of the session.
  useEffect(() => {
    if (!open || items.length > 0) return;
    Promise.all([
      fetch('/api/components').then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        return body;
      }),
      fetch('/api/tokens').then(r => (r.ok ? r.text() : '')),
    ])
      .then(([list, css]) => {
        const remote = Array.isArray(list) ? list : [];
        // Splice local components in, keeping alphabetical order so e.g.
        // "Navigation Header" sits next to "Navigation Drawer".
        const arr = [...remote, ...LOCAL_COMPONENTS]
          .sort((a, b) => a.title.localeCompare(b.title));
        setItems(arr);
        setTokensCss(css || '');
        if (arr.length > 0 && !selectedName) setSelectedName(arr[0].title);
      })
      .catch(e => setError(e?.message ?? 'Failed to load components from prod API'))
      .finally(() => setLoadingList(false));
  }, [open, items.length, selectedName]);

  // Detail fetch when selection changes. Local-only components are served
  // from LOCAL_COMPONENT_OVERRIDES without hitting the API.
  useEffect(() => {
    if (!selectedName) return;
    setActiveVariant(0);
    if (LOCAL_COMPONENTS.some(c => c.title === selectedName)) {
      setComponentData({ Title: selectedName, CodeExamples: [] });
      setLoadingDetail(false);
      return;
    }
    setLoadingDetail(true);
    fetch(`/api/components?name=${encodeURIComponent(selectedName)}`)
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
        return body;
      })
      .then(data => setComponentData(data ?? null))
      .catch(() => setComponentData(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedName]);

  // ESC closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return items;
    const q = filter.toLowerCase();
    return items.filter(i => i.title.toLowerCase().includes(q));
  }, [items, filter]);

  const variants = useMemo(() => {
    // Prefer a local override when one exists for this component (e.g.
    // Navigation Drawer — see LOCAL_COMPONENT_OVERRIDES).
    const override = componentData?.Title
      ? LOCAL_COMPONENT_OVERRIDES[componentData.Title]
      : null;
    const raw = override ?? componentData?.CodeExamples;
    if (!raw || !Array.isArray(raw)) return [];
    return raw
      .map((v, i) => ({
        // Prod Strapi shape: { Framework, Group, Variant, Code }. Group is
        // usually the variant name (Primary, Neutral, ...); Variant is often
        // null. Fall back through both, then index.
        name: v.Variant || v.Group || v.variant || `Variant ${i + 1}`,
        code: v.Code || v.code || '',
      }))
      .filter(v => v.code);
  }, [componentData]);

  return (
    <>
      {/* Backdrop — clicking it closes the drawer; not opaque so the workspace stays readable behind */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: 'fixed', inset: 0,
          background: ui.backdrop,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
          // Site Header sits at zIndex 1100 — keep the drawer above it so
          // its own header (with the "My Design System" title + close
          // button) isn't clipped by the global nav.
          zIndex: 1200,
        }}
      />

      <aside
        role="dialog"
        aria-label="Brandsync component library"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(820px, 96vw)',
          background: ui.bg, color: ui.text,
          borderLeft: `1px solid ${ui.panelLine}`,
          boxShadow: '-8px 0 32px rgba(0,0,0,0.10)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 240ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          zIndex: 1201,
          display: 'flex', flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Header */}
        <header style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${ui.panelLine}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>My Design System</span>
          <span style={{
            ...pillStyle, fontSize: 10, padding: '2px 7px',
          }}>Library</span>
          <div style={{ flex: 1 }} />
          <ThemeToggle theme={theme} onChange={setTheme} />
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, display: 'grid', placeItems: 'center',
              background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer',
              color: ui.textMuted,
            }}
          ><X size={18} /></button>
        </header>

        {/* Search */}
        <div style={{ padding: '12px 16px 0 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: ui.panel, border: `1px solid ${ui.panelLine}`,
            borderRadius: 8, padding: '8px 10px',
          }}>
            <MagnifyingGlass size={14} color={ui.textMuted} />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search components…"
              style={{
                flex: 1, border: 0, outline: 'none', background: 'transparent',
                fontSize: 13, color: ui.text, fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Body: list (left) + preview (right) */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, padding: 12, gap: 12 }}>
          {/* Compact list */}
          <div style={{
            width: 160, flexShrink: 0,
            background: ui.panel, border: `1px solid ${ui.panelLine}`,
            borderRadius: 8, overflow: 'auto', padding: 6,
          }}>
            {loadingList ? (
              <div style={{ padding: 12, fontSize: 12, color: ui.textMuted }}>Loading…</div>
            ) : error ? (
              <div style={{ padding: 12, fontSize: 12, color: '#b00020' }}>
                {error}
                <p style={{ marginTop: 8, color: ui.textMuted }}>Is Strapi running at localhost:1337?</p>
              </div>
            ) : (
              filtered.map(it => (
                <button
                  key={it.id}
                  onClick={() => setSelectedName(it.title)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 10px', borderRadius: 6,
                    background: selectedName === it.title ? ui.pill : 'transparent',
                    color: selectedName === it.title ? ui.text : ui.textMuted,
                    border: 0, cursor: 'pointer', fontSize: 12.5,
                    fontFamily: 'inherit',
                    fontWeight: selectedName === it.title ? 600 : 500,
                  }}
                >{it.title}</button>
              ))
            )}
          </div>

          {/* Preview area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {loadingDetail || !componentData ? (
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: ui.textMuted, fontSize: 13 }}>
                {loadingDetail ? 'Loading component…' : 'Pick a component'}
              </div>
            ) : (
              <ComponentPreview
                componentData={componentData}
                variants={variants}
                activeVariant={activeVariant}
                onVariantChange={setActiveVariant}
                tokensCss={tokensCss}
                theme={theme}
                brandPalette={brandPalette}
                selectedLogo={selectedLogo}
              />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────

const pillStyle = {
  display: 'inline-flex', alignItems: 'center',
  background: ui.pill, color: ui.text,
  border: `1px solid ${ui.pillBorder}`,
  borderRadius: 999, padding: '3px 10px', fontSize: 11, lineHeight: 1,
};

function ThemeToggle({ theme, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      background: ui.panel, borderRadius: 8, border: `1px solid ${ui.panelLine}`,
      padding: 2,
    }}>
      {[
        { key: 'light', icon: Sun,  label: 'Light' },
        { key: 'dark',  icon: Moon, label: 'Dark'  },
      ].map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-label={label}
          title={label}
          style={{
            width: 26, height: 26, display: 'grid', placeItems: 'center',
            background: theme === key ? ui.pill : 'transparent',
            color: theme === key ? ui.text : ui.textMuted,
            border: `1px solid ${theme === key ? ui.pillBorder : 'transparent'}`,
            borderRadius: 6, cursor: 'pointer',
          }}
        ><Icon size={14} /></button>
      ))}
    </div>
  );
}

function ComponentPreview({ componentData, variants, activeVariant, onVariantChange, tokensCss, theme, brandPalette, selectedLogo }) {
  if (variants.length === 0) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: ui.textMuted, fontSize: 13, textAlign: 'center', padding: 24 }}>
        <p>This component has no CodeExamples in Strapi yet.</p>
      </div>
    );
  }

  const current = variants[activeVariant] ?? variants[0];
  const srcDoc = buildPreviewDoc(parseCodeParts(current.code), tokensCss, theme, brandPalette, selectedLogo);
  // #eceef2 mirrors the workspace canvas color so the drawer preview
  // feels continuous with the main canvas. Pure white made the component
  // edges disappear; this neutral light gray gives each primitive its
  // own visible frame.
  const iframeBg = theme === 'light' ? '#eceef2' : '#191c22';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      {/* Component name */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: ui.text }}>{componentData.Title}</h2>
        <span style={{ fontSize: 11, color: ui.textFaint }}>{variants.length} variant{variants.length === 1 ? '' : 's'}</span>
      </div>

      {/* Variant tabs (wrap if many) */}
      {variants.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {variants.map((v, i) => (
            <button
              key={i}
              onClick={() => onVariantChange(i)}
              style={{
                padding: '4px 10px', fontSize: 11.5, borderRadius: 6, cursor: 'pointer',
                background: activeVariant === i ? ui.accent : ui.pill,
                color: activeVariant === i ? ui.accentText : ui.textMuted,
                border: `1px solid ${activeVariant === i ? ui.accent : ui.pillBorder}`,
                fontFamily: 'inherit', fontWeight: 500,
              }}
            >{v.name}</button>
          ))}
        </div>
      )}

      {/* Preview iframe — fills remaining height */}
      <div style={{
        flex: 1, borderRadius: 10, overflow: 'hidden',
        border: `1px solid ${ui.panelLine}`,
        background: iframeBg,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        minHeight: 280,
      }}>
        <iframe
          title={`${componentData.Title} — ${current.name}`}
          srcDoc={srcDoc}
          // allow-scripts lets the interactive shim below run (accordion
          // toggle, tab switching, etc.). No allow-same-origin → the
          // iframe still can't reach this page's DOM or storage.
          sandbox="allow-scripts"
          style={{ width: '100%', height: '100%', border: 0, background: iframeBg, display: 'block' }}
        />
      </div>
    </div>
  );
}
