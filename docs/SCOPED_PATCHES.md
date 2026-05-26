# Scoped patches — protocol for shrinking output cost on edits

## Why

The first version of `/api/generate` had a quality-driven simplification: the LLM **always returns the complete updated pattern markdown**, so the server can just `UPDATE corpus_entries SET content = ...` without a merge step. That's safe but expensive — by the 4th edit of a multi-view pattern, the model regenerates ~13k tokens of unchanged HTML/CSS to add ~3k of new content. **Roughly 75% of the output spend is wasted re-emission.**

Scoped patches fix that without compromising output quality.

## Protocol

The LLM returns a structured **envelope** instead of raw markdown. The envelope declares its scope; the server validates and folds the change into the existing pattern with `applyScopedPatch`.

### `scope: "full"` — first creation or cross-cutting refactors

```json
{
  "scope": "full",
  "html": "<main>...</main>",
  "css":  "/* full stylesheet */",
  "js":   "// optional"
}
```

Used when:
- The pattern is brand new (no existing content)
- The user asked for a refactor that crosses section boundaries ("rename all `.stat__` to `.metric__`")
- The model isn't confident it can narrow scope safely

This is the slowest path (full re-emission) but always correct. It's the fallback when any narrower scope fails validation.

### `scope: "section:<view>"` — change one named view

```json
{
  "scope": "section:home",
  "html": "<section data-view=\"home\">...new markup...</section>",
  "cssAppend": "/* optional new rules */"
}
```

Used when the user's request maps to a single `<section data-view="…">` block. The server:

1. Locates `<section data-view="home">…</section>` in the existing html block
2. Replaces it with the envelope's `html`
3. Appends `cssAppend` to the existing css block (if provided)

If the named view doesn't exist yet (e.g. "add a Funnels page"), the server inserts the new section before the last `</main>`. The model doesn't need to know whether it's adding vs replacing — same envelope shape either way.

**Validation guarantees** (enforced by `validateEnvelope`):
- `html` must start with `<section ... data-view="<view>">`
- `html` must end with `</section>`
- Empty html is rejected

If validation fails, the caller retries the LLM call with `scope: "full"` so the user never sees a broken merge.

### `scope: "css-only"` — pure style tweaks

```json
{
  "scope": "css-only",
  "cssAppend": ".bs-btn { background: var(--bs-color-success-default); }"
}
```

Used for "make buttons green"-style edits where the html doesn't change at all. Server appends the rules to the existing css block. HTML is untouched.

## Examples

### Adding the Home view to an existing dashboard

**Without scoped patches** (the current behavior of the deleted v1):
- Output tokens: ~13,000 (full pattern markdown)
- Of which ~10,000 is unchanged Analytics + Auth + nav drawer

**With scoped patches**:
```json
{
  "scope": "section:home",
  "html": "<section data-view=\"home\"><header class=\"dash__topbar\">…",
  "cssAppend": ".home__glance { display: grid; … }"
}
```
- Output tokens: ~3,500 (just the Home section + its CSS)
- **~72% reduction**, quality identical (unchanged sections preserved bit-for-bit)

### Changing button color

**Without**: re-emits 13k tokens for a one-line change.

**With**:
```json
{
  "scope": "css-only",
  "cssAppend": ".bs-btn-primary { background: var(--bs-color-success-default); }"
}
```
- Output tokens: ~80
- **~99% reduction**

## Quality preservation guarantees

1. **Section content quality is identical to full mode** — the model writes the same HTML/CSS for the section either way. Scoped mode just elides the unchanged content from the response.
2. **No drift in unchanged sections** — those sections literally aren't regenerated, so the model can't subtly mutate them (rename a class, drop an aria attribute, etc.). With `scope: "full"`, any of that is possible.
3. **Schema errors auto-fall-back to full mode** — invalid envelopes are caught and the caller retries with `scope: "full"`. The user never sees a broken patch.
4. **Shared CSS is safe** — already namespaced by section prefix (`home__*`, `aud__*`, `dash__*`). Edits to truly shared rules (`.bs-card`, `.dash__topbar`) trigger `scope: "full"`.

## System prompt fragment

When wiring an LLM, add the following to the system prompt so the model declares its scope honestly:

```
# Output scope

When you finish, return a JSON envelope describing the change, not the full
pattern. Use the narrowest scope that fits the user's request:

- `scope: "section:<view>"` — when the change is confined to one
  <section data-view="<view>"> block. Return that section's html + any
  new CSS rules in cssAppend.
- `scope: "css-only"` — when only styles change. Return cssAppend with
  the new/modified rules.
- `scope: "full"` — for first creation, multi-section refactors, or
  changes that touch shared CSS (.bs-card, .dash__topbar, etc.).

Narrower scope = faster generation. But if the change crosses
boundaries, use full — quality matters more than speed.
```

## Validation + fallback flow

```
LLM returns envelope
        ↓
applyScopedPatch(existingContent, envelope)
        ↓
   ┌─── throws PatchError ───┐
   │                          │
   ↓                          ↓
 retry once with         persist merged
 scope: "full"           content; return
                         to frontend
```

The retry budget is 1. If full-mode also fails (extremely rare — would mean the model can't emit a valid html block at all), the route returns 500 and the frontend surfaces "generation failed; try rephrasing."

## Implementation

- **`src/lib/patch.js`** — pure function `applyScopedPatch(existingContent, envelope)`. No side effects, no I/O. Easy to unit test.
- **`src/lib/patch.test.mjs`** — 12 tests covering all scopes + edge cases. Run with `node src/lib/patch.test.mjs`. No framework dep.
- **`src/app/api/generate/route.js`** — currently a 501 stub. Imports `applyScopedPatch` ready for the LLM hookup. Has a debug-only `__debugPatchOnly` mode to exercise the merger end-to-end via curl during the hookup work.

## Token math — combined with the input-side bundle optimization

| | Per turn (current) | Per turn (scoped) |
|---|---:|---:|
| Input | ~5,500 (cached: ~1,600) | ~5,500 (cached: ~1,600) |
| Output | ~13,000 | ~3,500 |
| Cost (Sonnet 4.6) | ~$0.21 | ~$0.06 |

Across a 10-edit session on a single pattern: **roughly $2.10 → $0.60** — another ~70% cut on top of the ~50% the bundled-input approach already provided. Compounding across PMs × generations × the lifetime of a pattern, that's where the BYOK case becomes genuinely cheap relative to v0/Lovable/Figma Make.
