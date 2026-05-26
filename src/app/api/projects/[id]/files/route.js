import { getPool, resolveUserId, userOwnsProject } from '@/lib/db';

// POST /api/projects/:id/files  { userEmail, corpusEntryId }
// Adds the given corpus entry to the project. ON CONFLICT DO NOTHING so
// re-adding the same pattern is a no-op rather than an error.
export async function POST(request, { params }) {
  const { id: projectId } = await params;
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const { userEmail, corpusEntryId } = body ?? {};
  if (!userEmail) return Response.json({ error: 'userEmail required' }, { status: 400 });
  if (!corpusEntryId) return Response.json({ error: 'corpusEntryId required' }, { status: 400 });

  const client = getPool();
  try {
    const userId = await resolveUserId(client, userEmail);
    if (!userId) return Response.json({ error: 'no such user' }, { status: 404 });
    if (!(await userOwnsProject(client, projectId, userId))) {
      return Response.json({ error: 'project not found' }, { status: 404 });
    }

    const { rows } = await client.query(
      `INSERT INTO project_files (project_id, corpus_entry_id)
       VALUES ($1, $2)
       ON CONFLICT (project_id, corpus_entry_id) DO NOTHING
       RETURNING id, corpus_entry_id, added_at`,
      [projectId, corpusEntryId],
    );
    await client.query('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId]);

    return Response.json({ file: rows[0] ?? null, added: rows.length > 0 }, { status: 201 });
  } catch (err) {
    console.error('[api/projects/[id]/files POST] error:', err);
    return Response.json({ error: err.message ?? 'unknown error' }, { status: 500 });
  }
}
