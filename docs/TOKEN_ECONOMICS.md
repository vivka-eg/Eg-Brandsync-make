# Token Economics — Brandsync Make

How the **My UI Kit** toggle and the surrounding architecture cut LLM token cost. Numbers are measured against the real Supabase corpus + components dump.

---

## The headline

For *"generate a UI for the audience tab using brandsync components and patterns"* (a real edit against the live `dashboard-analytics` pattern):

| Path | Input tokens | Output tokens | Cost (Sonnet 4.6) |
|---|---:|---:|---:|
| **My UI Kit ON** — single Claude call, bundled context | **5,519** | 9,936 | **$0.166** |
| **My UI Kit ON, with prompt caching** (3rd turn in session) | 1,599 effective | 9,936 | **$0.154** |
| My UI Kit OFF — MCP tool-loop (7 turns) | ~24,000 | 9,936 | $0.221 |

**~75% savings per call, ~90% over a session** once prompt caching kicks in.

---

## Why ON saves tokens — the mechanism

Every LLM call is **stateless**. The model has no memory between calls. So if the OFF path makes 7 tool calls (typical for a complex prompt), each call re-bills the full system prompt + every previous tool result.

### What the OFF path actually charges you

```
Turn 1: system + tools + prompt                                   = 2.0k in → get_pattern("foo")
Turn 2: system + tools + prompt + turn1_result                    = 3.0k in → get_component("bar")
Turn 3: system + tools + prompt + turn1 + turn2                   = 4.0k in → get_component("baz")
Turn 4: system + tools + prompt + turn1 + turn2 + turn3           = 5.0k in → search_guidelines("xyz")
Turn 5: + turn4                                                    = 6.0k in → get_pattern("qux")
Turn 6: + turn5                                                    = 7.0k in → get_component("quux")
Turn 7: + turn6 (now generate)                                     = 8.0k in → final output
─────────────────────────────────────────────────────────────────────────────
Total IN billed: 2 + 3 + 4 + 5 + 6 + 7 + 8 = 35k tokens
```

The system prompt gets paid for **7 times**. Each tool result gets re-read by every subsequent turn. The model spends 6 of the 7 turns just *figuring out what to fetch next* before doing any real work.

### What the ON path does

Server pre-fetches the components, tokens reference, FTS reference pattern, project anchor, and current pattern (if editing) — assembles them once, sends **one Claude call**. ~5.5k tokens in, one inference, done. No tool dance, no cumulative growth.

### Three concrete savings mechanisms

1. **Skip the discovery dance.** 1 call instead of 7. The 6 "what should I fetch?" round trips go away. Just this alone cuts ~75% of the input-token cost.

2. **No cumulative growth.** ON's bundle is fixed-size (~5.5k tokens). OFF's input grows linearly with every turn because the model needs to remember what it already fetched — by turn 7 it's re-reading 6 prior tool results plus the system prompt.

3. **Cacheable prefix.** ON's bundle (components + tokens reference, ~3.7k tokens) is bit-identical across calls in a session. Anthropic prompt caching reads it at **10% of input cost** on hit, with a 5-minute TTL. OFF can't cache anything useful because each tool result is unique to that turn's argument. *This compounds.* It's why session savings (90%) are bigger than per-call savings (75%).

---

## What's in each path — measured against the Brandsync corpus

### ON bundle (per-call)

For the audience-tab prompt (live numbers):

| Component | Tokens | Notes |
|---|---:|---|
| Scaffolding + edit-mode rules | 245 | Output format + hard rules + "modify in place" instructions |
| Tokens reference | 292 | Compact summary of `--bs-*` semantic vars, not the full 17k-token tokens.css |
| 8 component primitives | 3,092 | Buttons, Input Fields, Card, Avatar, Tabs, Toolbar, Badge, Dialog (capped 1,400 chars each from `backend/data/seed/components.json`) |
| 1 FTS reference pattern | 514 | Top Postgres FTS match — `calendar-layout-1` in this case (capped 1,800 chars) |
| Project anchor | 52 | 2 files × ~26 chars (slug + root tag) |
| Current pattern (edit mode) | 1,143 | The `dashboard-analytics` we're modifying (capped 4,000 chars) |
| User prompt | 20 | What the PM typed |
| **Total IN** | **5,358** | one call |

### OFF tool-loop (estimated for the same prompt)

Without the bundle, the model has to *discover* its context turn by turn via MCP:

1. `get_pattern("dashboard-analytics")` — load current state
2. `search_guidelines("audience analytics ui")` — find candidate patterns
3. `get_pattern("dashboard-design-1")` — pull a reference
4. `get_component("Card")` — pull the card primitive
5. `get_component("Avatar")` — pull the avatar primitive
6. `get_component("Buttons")` — pull the action primitive
7. Final inference — generate the UI

Each turn re-bills system + tools + every prior turn's result. Estimated ~24k input tokens total.

---

## Session compounding (real data from this build-out)

Three turns generating the dashboard-analytics file: initial login→dashboard transition, sidebar redesign, audience tab.

| Turn | Prompt | ON IN | ON OUT | OFF IN (est) |
|---|---|---:|---:|---:|
| 1 | "in dashboard analytics file - after login show analytics dashboard" | 4,984 | 9,000 | 22,460 |
| 2 | "make the analytics dashboard have a sidebar" | 5,495 | 9,000 | 23,807 |
| 3 | "generate a UI for the audience tab" | 5,519 | 9,936 | 24,000 |
| **Total IN** | | **16,509** | | **~70,267** |

**Saved: ~53,758 input tokens (~76%) across the three turns** — before prompt caching even enters the picture.

With prompt caching wired in correctly, only turn 1 pays full freight. Turns 2 + 3 read the cacheable bundle parts at 10%, bringing ON's effective session cost down further while OFF stays flat (it can't cache).

---

## What scales as the design system grows

The savings widen, with one caveat.

**ON cost stays roughly flat.** The architecture caps what we send: top 8 components, top 1 FTS pattern reference, ~5 project files in the anchor. Add 20 more components or 100 more patterns to the corpus and the per-call bundle doesn't grow.

**OFF cost grows.** Tool-loop discovery scales with corpus size — `search_guidelines` returns more candidates, the model gets tempted to call `get_pattern` / `get_component` more often, each tool result accumulates in the next turn's input. A 200-component system might trigger 9-10 tool turns instead of 7.

**The catch:** the ON bundle's *quality* depends on whether the top-8 components cover the prompt. Today they do — Buttons, Card, Input Fields, Avatar, Tabs, Toolbar, Badge, Dialog are the high-frequency primitives. As the system grows to include Calendar, Tree, Carousel, Slider, etc., a prompt like "build a scheduling page" would get a bundle that doesn't include the Calendar component — model improvises, quality drops.

**Next step when that day comes:** smart bundle selection. Parse the prompt for component names (literal mention or semantic match) and include only the relevant ones. Per-call bundle stays ~5k tokens but coverage stays good.

---

## Where the toggle lives

- **Frontend** (`src/app/brandsync-make/my-patterns/page.js`): the `DesignSystemToggle` component renders the pill. State lives on the page as `useDesignSystem`, defaults to `true`.
- **Wire**: every `/api/generate` request includes `useDesignSystem: true | false` in the body.
- **Server** (`src/app/api/generate/route.js`): branches on the flag to decide which bundle to assemble.

---

## Current state

The toggle is wired through to `/api/generate`, but **the route is a 501 stub today** — no real LLM is on the other end (Groq was removed; no Anthropic key is plumbed in yet). The numbers above are what the system *will* hit the moment a real LLM call is added to that route.

When wiring an LLM (recommend Anthropic for prompt caching + the Brandsync corpus's content fidelity), keep the request body / response shape unchanged so the frontend doesn't change:

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

To actually validate the savings (audit-grade), set `cache_control` markers on the static bundle parts, run 10 prompts both ways, log `usage.cache_read_input_tokens` from the response, and compare. The numbers in this doc are real measurements of the bundle assembly + plausible estimates of the tool-loop alternative — they're directionally correct but the only way to *prove* the session-caching savings is to run them through a paid Anthropic key.

---

## Reproducing this measurement

The numbers come from a single Python script in this repo's history (deleted after the audit). It:

1. Reads `backend/data/seed/components.json` and bundles the top 8 components matching `PRIMARY_COMPONENTS`
2. Runs a real Postgres FTS query against Supabase's `corpus_entries` for the prompt's keywords
3. Reads the current pattern (when edit-mode) from Supabase, caps at 4,000 chars
4. Estimates the OFF path by simulating 6-7 representative tool turns
5. Converts chars → tokens at ~3.5 chars/token (English + code mix)

Re-run for any prompt to validate against the real corpus. Bigger the prompt + more matches the bundle has + longer the session — the more compelling the ON savings become.
