// POST /api/generate
//
// HTTP-driven generation is currently disabled. The previous wiring
// (Groq Llama 3.3 70b → corpus_entries) hit free-tier daily/per-minute
// caps and produced inconsistent output. Generation is now driven from
// the Claude Code chat: describe what you want there, Claude reads the
// corpus + component dump directly and INSERTs the resulting pattern
// into Supabase. This route stays so the frontend's send button + the
// transcript UI surface a clear, actionable message instead of a 404.
//
// To re-enable HTTP generation later, swap in a model call (Anthropic
// Messages API is the natural fit) inside this handler, keeping the
// existing response shape: { pattern, edited, projectFile, contextUsed,
// usage, model }.

export const runtime = 'nodejs';

export async function POST() {
  return Response.json(
    {
      error: 'Generation via HTTP is not configured. Drive Brandsync Make from the Claude Code chat for now — describe what you want there and Claude will INSERT the pattern directly.',
    },
    { status: 501 },
  );
}
