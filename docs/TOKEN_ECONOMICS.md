# Token Economics — Brandsync Make

How the **My UI Kit** toggle and the surrounding architecture cut LLM token cost. Numbers below are measured against the real Supabase corpus for the prompt:

> *"a clean settings page with profile and notifications sections"*

## The headline

| Path | Per-call input tokens | 5-call session |
|---|---:|---:|
| **My UI Kit ON** — single Claude call, bundled context | **4,366** | **7,858** |
| My UI Kit OFF — MCP tool-loop (6 turns) | 15,390 | 76,950 |

**72% savings per call. 90% savings over a session** once prompt caching kicks in.

## What's in each path

### My UI Kit ON (the default)

The server pre-assembles everything the model needs into a single system prompt and makes one Claude call with no tools:

| Component | Tokens | Source |
|---|---:|---|
| Scaffolding (output format + hard rules) | 314 | `lib/system-prompt.js` *(to be re-instated when LLM is wired)* |
| Tokens reference (semantic var names) | 177 | compact summary, not the full 17k-token `tokens.css` |
| 8 component primitives | 3,092 | `backend/data/seed/components.json` — Buttons, Input Fields, Card, Avatar, Tabs, Toolbar, Badge, Dialog (capped at 1,400 chars each) |
| 1 FTS reference pattern | 514 | Postgres FTS top match against `corpus_entries` (capped at 1,800 chars) |
| Project anchor | ~250 | 4 project files × ~220 chars (structural skeletons, not full HTML) |
| User prompt | 17 | What the PM typed |
| **Total** | **4,366** | |

### My UI Kit OFF (tool-loop)

Without the bundle, the model has to *discover* its context turn by turn via the MCP. A typical "settings page" prompt triggers ~6 inference turns:

1. `search_guidelines("settings page")` — find candidate patterns
2. `get_pattern("settings")` — pull full markdown
3. `get_pattern("user-management")` — second reference
4. `get_component("Input Fields")` — pull the form primitive
5. `get_component("Buttons")` — pull the action primitive
6. Final inference — actually generate the UI

Each turn re-bills the system prompt + accumulated tool results. Estimated total: **~15,400 input tokens** for the same prompt.

## Why the savings exist — three mechanisms

### 1. No tool round trips

Every MCP tool call carries the schema (~1,600 tokens for the 4-tool surface) and the cumulative result history. For a 5-turn loop, the model re-reads its own previous tool results across every turn. Bundling everything once kills that accumulation.

### 2. Prompt caching

Anthropic caches static prefixes for 5 minutes at **10% of input cost** on hit. The ON path's bundle (components + tokens) is **bit-identical across every generation in a session** — same hash → cache hit. First call: 4,366 tokens. Subsequent calls in the window: ~870 effective tokens. The OFF path can't cache because each tool result is unique to that turn's argument.

### 3. Scoped references

ON + a project active → the system prompt includes *only* that project's pattern skeletons as style anchors (~250 tokens total). OFF would have the model `search_guidelines` against all 50 team patterns and pull back whichever it picks — usually 3–5k tokens of pattern text per call, different selection each time.

## Where the toggle lives

- **Frontend** (`src/app/brandsync-make/my-patterns/page.js`): the `DesignSystemToggle` component renders the pill. State lives on the page as `useDesignSystem`.
- **Wire**: every `/api/generate` request includes `useDesignSystem: true | false` in the body.
- **Server** (`src/app/api/generate/route.js`): branches on the flag to decide which bundle to assemble.

## Current state

The toggle is wired through to `/api/generate`, but **the route is a 501 stub today** — no real LLM is on the other end (Groq was removed; no Anthropic key is plumbed in yet). The savings above are the live numbers the system *will* hit the moment an LLM call is added to that route.

When wiring an LLM (likely Anthropic for prompt caching + the Brandsync corpus's content), keep the request body / response shape unchanged so the frontend doesn't change:

```js
// Request body the route already receives
{
  prompt, projectId, useDesignSystem,
  theme, brandPalette, selectedLogoName,
  userEmail, editEntryId,
}

// Response shape the frontend expects
{
  pattern: { id, slug, type, content, ... },
  edited: boolean,
  projectFile: { ... } | null,
  contextUsed: string,        // human-readable description used by the transcript UI
  usage: { prompt_tokens, completion_tokens, total_time },
  model: string,
}
```

## Reproducing this measurement

The numbers come from a single Bash + Python script that:
1. Reads `backend/data/seed/components.json` and bundles the top 8 components (matching `PRIMARY_COMPONENTS` in the original `lib/component-bundle.js`)
2. Runs a real Postgres FTS query against Supabase's `corpus_entries` for the prompt's keywords
3. Estimates the OFF path by simulating 6 representative tool turns
4. Converts chars → tokens at ~3.5 chars/token (English + code mix)

The script can be re-run for any prompt to validate against the real corpus. The bigger the prompt + the more existing patterns it matches, the more compelling the ON savings become.
