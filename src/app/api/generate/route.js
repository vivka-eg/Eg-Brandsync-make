import { getPool, resolveUserId } from '@/lib/db';
import { applyScopedPatch, PatchError } from '@/lib/patch';

// POST /api/generate
//
// HTTP-driven generation is currently disabled — `/api/generate` doesn't
// call an LLM. Generations run through the Claude Code chat for now.
// The route still exists so the frontend's send button + transcript UI
// surface a clear, actionable message instead of a 404.
//
// When an LLM is wired in, the model should return a *scoped patch
// envelope* rather than the full re-emitted markdown:
//
//   { scope: "section:<view>", html, cssAppend? }    ← preferred for edits
//   { scope: "css-only", cssAppend }                  ← styling tweaks
//   { scope: "full", html, css, js? }                 ← first creation / refactors
//
// Why: re-emitting the full pattern on every edit is wasteful. A typical
// "add a new view" turn at ~13k output tokens drops to ~3.5k once the
// model declares its scope and the server uses applyScopedPatch to fold
// in just the change. ~75% output-token reduction without quality loss
// because the unchanged sections are preserved BIT FOR BIT.
//
// See docs/TOKEN_ECONOMICS.md + docs/SCOPED_PATCHES.md (in the Make repo).

export const runtime = 'nodejs';

const NO_LLM_MESSAGE =
  'Generation via HTTP is not configured. Drive Brandsync Make from the Claude Code chat for now — describe what you want there and Claude will INSERT the pattern directly.';

export async function POST(request) {
  // Once the LLM is wired in, this block becomes:
  //   1. resolve user / project (existing pattern below)
  //   2. assemble system prompt + envelope-schema instructions
  //   3. call the model — expect a scoped envelope back
  //   4. parse the envelope; on PatchError (schema or merge failure)
  //      retry once with scope="full" so quality never regresses
  //   5. UPDATE corpus_entries with the merged content
  //
  // The patch infra is already imported above and unit-tested
  // (src/lib/patch.test.mjs) so wiring the LLM is a contained change.

  let body;
  try { body = await request.json(); } catch { body = {}; }
  // Validation that runs today even without an LLM — useful for testing
  // the scoped-patch contract end-to-end with hand-crafted envelopes.
  if (body?.__debugPatchOnly && body?.envelope && body?.existingContent != null) {
    return runPatchOnlyDebug(body.envelope, body.existingContent);
  }

  return Response.json({ error: NO_LLM_MESSAGE }, { status: 501 });
}

// Debug-only path: lets us exercise the patch merger from a curl command
// without spinning up an LLM. Caller sends:
//   POST /api/generate { __debugPatchOnly: true, envelope, existingContent }
// Returns the merged content or the PatchError details. Useful during
// the LLM-hookup work.
function runPatchOnlyDebug(envelope, existingContent) {
  try {
    const merged = applyScopedPatch(existingContent, envelope);
    return Response.json({ ok: true, merged });
  } catch (err) {
    if (err instanceof PatchError) {
      return Response.json(
        { ok: false, code: err.code, error: err.message },
        { status: 422 },
      );
    }
    return Response.json({ ok: false, error: err.message ?? 'unknown' }, { status: 500 });
  }
}

// Marker so build-time linters don't drop the unused imports. They WILL
// be used once the LLM call lands.
export const _patchInfra = { applyScopedPatch, getPool, resolveUserId, PatchError };
