// Run with: node src/lib/patch.test.mjs
// (No jest/vitest dep — keeps the test surface minimal until the rest of the
// codebase adds a runner.)

import { applyScopedPatch, PatchError } from './patch.js';

let passed = 0, failed = 0;
const tests = [];

function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertMatch(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`expected ${label || 'output'} to contain "${needle.slice(0, 60)}…"`);
  }
}
function assertNoMatch(haystack, needle, label) {
  if (haystack.includes(needle)) {
    throw new Error(`expected ${label || 'output'} NOT to contain "${needle.slice(0, 60)}…"`);
  }
}

// ─── Fixtures ────────────────────────────────────────────────────────
const EXISTING = `\`\`\`html
<main class="bs-app-content">
  <section class="view" data-view="analytics">
    <h1>Analytics</h1>
    <p>Original analytics body.</p>
  </section>
  <section class="view" data-view="home" hidden>
    <h1>Home placeholder</h1>
  </section>
</main>
\`\`\`

\`\`\`css
.bs-app-content { padding: 24px; }
.view h1 { font-size: 24px; }
\`\`\`
`;

// ─── Tests ───────────────────────────────────────────────────────────
test('scope=full replaces everything', () => {
  const out = applyScopedPatch(EXISTING, {
    scope: 'full',
    html: '<div class="brand-new">Fresh start</div>',
    css:  '.brand-new { color: red; }',
  });
  assertMatch(out, '<div class="brand-new">');
  assertMatch(out, '.brand-new { color: red; }');
  assertNoMatch(out, 'Original analytics body', 'previous html');
  assertNoMatch(out, '.bs-app-content { padding: 24px; }', 'previous css');
});

test('scope=section:home replaces the home section only', () => {
  const out = applyScopedPatch(EXISTING, {
    scope: 'section:home',
    html: '<section class="view" data-view="home"><h1>Hello home</h1></section>',
    cssAppend: '.home__hero { padding: 40px; }',
  });
  assertMatch(out, '<h1>Hello home</h1>');
  assertMatch(out, '.home__hero { padding: 40px; }');
  // Analytics section MUST be preserved bit-for-bit.
  assertMatch(out, '<section class="view" data-view="analytics">');
  assertMatch(out, 'Original analytics body.');
  // Old home placeholder text gone.
  assertNoMatch(out, 'Home placeholder', 'old home content');
  // Original CSS preserved + new appended.
  assertMatch(out, '.bs-app-content { padding: 24px; }');
});

test('scope=section:<new-view> inserts before the last </main>', () => {
  const out = applyScopedPatch(EXISTING, {
    scope: 'section:settings',
    html: '<section class="view" data-view="settings"><h1>Settings</h1></section>',
  });
  // New section present
  assertMatch(out, '<section class="view" data-view="settings">');
  // It came before </main>
  const newIdx = out.indexOf('data-view="settings"');
  const mainClose = out.indexOf('</main>');
  assert(newIdx < mainClose, 'new section should be inserted before </main>');
  // Existing sections still there
  assertMatch(out, 'data-view="analytics"');
  assertMatch(out, 'data-view="home"');
});

test('scope=css-only appends rules, html untouched', () => {
  const out = applyScopedPatch(EXISTING, {
    scope: 'css-only',
    cssAppend: '.bs-btn { color: var(--bs-color-primary-default); }',
  });
  assertMatch(out, '.bs-btn { color: var(--bs-color-primary-default); }');
  assertMatch(out, '.bs-app-content { padding: 24px; }');  // existing kept
  assertMatch(out, 'Original analytics body.');              // html untouched
});

test('invalid scope throws PatchError', () => {
  let err;
  try {
    applyScopedPatch(EXISTING, { scope: 'invalid' });
  } catch (e) { err = e; }
  assert(err instanceof PatchError, 'expected PatchError');
  assert(err.code === 'invalid_envelope');
});

test('scope=section:X but html doesnt match throws', () => {
  let err;
  try {
    applyScopedPatch(EXISTING, {
      scope: 'section:home',
      html: '<div>oops not a section</div>',
    });
  } catch (e) { err = e; }
  assert(err instanceof PatchError);
  assert(err.code === 'invalid_envelope');
  assertMatch(err.message, 'must start with <section data-view="home">');
});

test('scope=section without closing </section> throws', () => {
  let err;
  try {
    applyScopedPatch(EXISTING, {
      scope: 'section:home',
      html: '<section data-view="home"><h1>x</h1>',
    });
  } catch (e) { err = e; }
  assert(err instanceof PatchError);
  assertMatch(err.message, 'must end with </section>');
});

test('scope=full on empty/new pattern works (first-creation path)', () => {
  const out = applyScopedPatch('', {
    scope: 'full',
    html: '<div>hello</div>',
    css:  'div { color: red; }',
  });
  assertMatch(out, '<div>hello</div>');
  assertMatch(out, 'div { color: red; }');
});

test('scope=section on empty pattern throws (caller should retry full)', () => {
  let err;
  try {
    applyScopedPatch('', {
      scope: 'section:home',
      html: '<section data-view="home"></section>',
    });
  } catch (e) { err = e; }
  assert(err instanceof PatchError);
  assert(err.code === 'parse_failure');
});

test('cssAppend on section patch when no css block exists creates one', () => {
  const htmlOnly = '```html\n<main><section data-view="x">y</section></main>\n```';
  const out = applyScopedPatch(htmlOnly, {
    scope: 'section:x',
    html: '<section data-view="x">new</section>',
    cssAppend: '.x { color: green; }',
  });
  assertMatch(out, '```css');
  assertMatch(out, '.x { color: green; }');
});

test('JS block in existing pattern is preserved through a section patch', () => {
  const withJs = EXISTING + `\n\`\`\`js\nconsole.log("hi");\n\`\`\`\n`;
  const out = applyScopedPatch(withJs, {
    scope: 'section:home',
    html: '<section data-view="home"><h1>new</h1></section>',
  });
  assertMatch(out, 'console.log("hi");');
});

test('section replace is bit-identical for unchanged sections', () => {
  // The analytics section text must come through unchanged.
  const out = applyScopedPatch(EXISTING, {
    scope: 'section:home',
    html: '<section data-view="home">x</section>',
  });
  // Pull the analytics section out of both and compare.
  const m = out.match(/<section class="view" data-view="analytics">[\s\S]*?<\/section>/);
  const orig = EXISTING.match(/<section class="view" data-view="analytics">[\s\S]*?<\/section>/);
  assert(m && orig && m[0] === orig[0], 'analytics section drifted');
});

// ─── Runner ──────────────────────────────────────────────────────────
for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log(`  ✓ ${t.name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${t.name}\n      ${e.message}`);
  }
}
console.log(`\n${passed} passed, ${failed} failed (of ${tests.length})`);
process.exit(failed === 0 ? 0 : 1);
