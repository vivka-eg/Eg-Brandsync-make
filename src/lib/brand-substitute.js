// Brand-substitution helpers shared by the workspace canvas (my-patterns
// page) and the Components Drawer. Both render Brandsync HTML inside an
// iframe with the user's selected logo + brand color palette swapped in.
//
// - BRAND_PALETTES: the catalog of brand color palette names defined in
//   tokens.css under --bs-brand-colors-<name>-<step>. The picker UI iterates
//   this list; the iframe injects `brandOverrideCss(palette)` so
//   --bs-brand-* resolves to the chosen palette's steps.
//
// - substituteBrand: swaps the `{{logo}}` / `{{logo-icon}}` / `{{product-name}}`
//   placeholders that patterns and component overrides embed.

export const BRAND_PALETTES = [
  'blue', 'cobalt', 'purple', 'magenta', 'maroon', 'violet',
  'steel', 'teal', 'jade', 'green', 'lime', 'yellow', 'amber', 'orange',
];

export function brandOverrideCss(palette) {
  if (!palette || palette === 'blue') return ''; // 'blue' is the tokens.css default
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  return ':root {\n' +
    steps.map(s => `  --bs-brand-${s}: var(--bs-brand-colors-${palette}-${s});`).join('\n') +
    '\n}';
}

// Substitute the brand placeholders. If no logo is selected, placeholders
// fall back to empty strings (the iframe's CSS hides `img[src=""]`) and
// product-name defaults to 'Brandsync'.
//
// `light` = light-colored logo (used on dark backgrounds).
// `dark`  = dark-colored logo (used on light backgrounds).
export function substituteBrand(html, theme, selectedLogo) {
  if (!selectedLogo) {
    return html
      .replace(/\{\{logo\}\}/g, '')
      .replace(/\{\{logo-icon\}\}/g, '')
      .replace(/\{\{product-name\}\}/g, 'Brandsync');
  }
  const horiz = theme === 'dark'
    ? (selectedLogo.assets?.light?.horizontal || selectedLogo.assets?.dark?.horizontal || selectedLogo.assets?.logo || '')
    : (selectedLogo.assets?.dark?.horizontal || selectedLogo.assets?.light?.horizontal || selectedLogo.assets?.logo || '');
  return html
    .replace(/\{\{logo\}\}/g, horiz)
    .replace(/\{\{logo-icon\}\}/g, selectedLogo.assets?.logo || horiz || '')
    .replace(/\{\{product-name\}\}/g, selectedLogo.name || 'Brandsync');
}
