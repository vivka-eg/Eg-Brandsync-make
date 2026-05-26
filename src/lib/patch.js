// Scoped-patch merging for Brandsync Make's /api/generate.
//
// When the LLM finishes a turn it returns an envelope describing WHAT
// changed, not the whole file. The server uses applyScopedPatch to
// fold those changes into the pattern's existing markdown.
//
// Why: re-emitting the full pattern (~13k tokens for a multi-view file)
// on every edit is wasteful — the model regenerates 10k tokens of
// unchanged content. Scoped patches cut output cost ~75% on edits
// without compromising the result: the model still generates the same
// markup for the section it's modifying, the unchanged sections are
// preserved BIT FOR BIT because we never regenerate them.
//
// Envelope shapes:
//
//   { scope: "full", html, css, js? }
//      → returns a fresh markdown with the three fenced blocks.
//        Used for: first creation of a pattern, refactors that span
//        sections, anything where the model isn't confident it can
//        narrow the scope.
//
//   { scope: "section:<view>", html, cssAppend? }
//      → finds <section data-view="<view>">…</section> in the existing
//        html block, replaces it. Appends cssAppend to the css block.
//        If the section doesn't exist yet (new view being added),
//        inserts before </main>.
//        html MUST start with <section data-view="<view>"> matching
//        the scope's view name.
//
//   { scope: "css-only", cssAppend }
//      → just appends new CSS rules. Used for: tweaks that only touch
//        styling ("make buttons green"). Does not touch html.
//
// Validation: the caller can fall back to scope="full" + retry if the
// envelope fails structural checks. The merger never returns invalid
// content — either a clean merged markdown or it throws.

const HTML_BLOCK_RE = /```html\n([\s\S]*?)```/;
const CSS_BLOCK_RE  = /```css\n([\s\S]*?)```/;
const JS_BLOCK_RE   = /```(?:js|javascript)\n([\s\S]*?)```/;

export class PatchError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code; // 'invalid_envelope' | 'section_not_found' | 'parse_failure'
  }
}

// Stitch an html/css(/js) trio back into the markdown shape patterns use.
function renderMarkdown({ html, css, js }) {
  let out = '```html\n' + html.trim() + '\n```';
  if (css?.trim()) out += '\n\n```css\n' + css.trim() + '\n```';
  if (js?.trim())  out += '\n\n```js\n' + js.trim() + '\n```';
  return out + '\n';
}

function parseMarkdown(content) {
  return {
    html: content.match(HTML_BLOCK_RE)?.[1] ?? '',
    css:  content.match(CSS_BLOCK_RE)?.[1]  ?? '',
    js:   content.match(JS_BLOCK_RE)?.[1]   ?? '',
  };
}

// Find the data-view="X" section in html. Returns { start, end, full } or null.
// Uses lazy match across newlines so nested elements inside the section don't
// break the boundary.
function findViewSection(html, view) {
  const escaped = view.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<section\\b[^>]*\\bdata-view="${escaped}"[^>]*>[\\s\\S]*?<\\/section>`,
    'i',
  );
  const m = html.match(re);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length, full: m[0] };
}

function validateEnvelope(env) {
  if (!env || typeof env !== 'object') {
    throw new PatchError('envelope must be an object', 'invalid_envelope');
  }
  const { scope } = env;
  if (typeof scope !== 'string') {
    throw new PatchError('envelope.scope must be a string', 'invalid_envelope');
  }
  if (scope === 'full') {
    if (typeof env.html !== 'string' || !env.html.trim()) {
      throw new PatchError('scope=full requires non-empty html', 'invalid_envelope');
    }
    return { kind: 'full' };
  }
  if (scope === 'css-only') {
    if (typeof env.cssAppend !== 'string' || !env.cssAppend.trim()) {
      throw new PatchError('scope=css-only requires non-empty cssAppend', 'invalid_envelope');
    }
    return { kind: 'css-only' };
  }
  if (scope.startsWith('section:')) {
    const view = scope.slice('section:'.length);
    if (!view) {
      throw new PatchError('scope=section: requires a view name', 'invalid_envelope');
    }
    if (typeof env.html !== 'string' || !env.html.trim()) {
      throw new PatchError(`scope=section:${view} requires non-empty html`, 'invalid_envelope');
    }
    // The html MUST be a single <section data-view="<view>"> ... </section>.
    // Wrap the check in a regex to avoid surprises from leading whitespace.
    const opens = new RegExp(
      `^\\s*<section\\b[^>]*\\bdata-view="${view.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
      'i',
    );
    if (!opens.test(env.html)) {
      throw new PatchError(
        `scope=section:${view} html must start with <section data-view="${view}">`,
        'invalid_envelope',
      );
    }
    if (!/<\/section>\s*$/i.test(env.html)) {
      throw new PatchError(
        `scope=section:${view} html must end with </section>`,
        'invalid_envelope',
      );
    }
    return { kind: 'section', view };
  }
  throw new PatchError(`unknown scope "${scope}"`, 'invalid_envelope');
}

// Insert `block` just before the LAST closing </main> in `html`. Used when
// a section:<view> patch refers to a brand-new view (no existing section
// to replace). If no </main> exists, append.
function insertBeforeLastMainClose(html, block) {
  const lastMainClose = html.lastIndexOf('</main>');
  if (lastMainClose === -1) return html + '\n\n' + block;
  return html.slice(0, lastMainClose) + block + '\n\n    ' + html.slice(lastMainClose);
}

export function applyScopedPatch(existingContent, envelope) {
  const kind = validateEnvelope(envelope);

  // Full scope — bypass merging entirely.
  if (kind.kind === 'full') {
    return renderMarkdown({
      html: envelope.html,
      css:  envelope.css ?? '',
      js:   envelope.js  ?? '',
    });
  }

  const parsed = parseMarkdown(existingContent || '');
  // If the existing pattern has no html block, the only sensible fallback
  // is to refuse — section/css-only patches assume there's something to
  // patch. The caller should switch to scope=full and retry.
  if (!parsed.html) {
    throw new PatchError(
      'existing pattern has no ```html block; use scope=full for first creation',
      'parse_failure',
    );
  }

  if (kind.kind === 'css-only') {
    const css = (parsed.css.trimEnd() + '\n\n' + envelope.cssAppend.trim() + '\n').trim();
    return renderMarkdown({ html: parsed.html, css, js: parsed.js });
  }

  // kind.kind === 'section'
  const { view } = kind;
  const found = findViewSection(parsed.html, view);
  let newHtml;
  if (found) {
    // Replace in place.
    newHtml = parsed.html.slice(0, found.start) + envelope.html.trim() + parsed.html.slice(found.end);
  } else {
    // New section — insert before the last </main>.
    newHtml = insertBeforeLastMainClose(parsed.html, envelope.html.trim());
  }

  let css = parsed.css;
  if (envelope.cssAppend && envelope.cssAppend.trim()) {
    css = (css.trimEnd() + '\n\n' + envelope.cssAppend.trim() + '\n').trim();
  }

  return renderMarkdown({ html: newHtml, css, js: parsed.js });
}
