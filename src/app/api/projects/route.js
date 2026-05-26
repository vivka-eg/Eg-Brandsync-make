import { getPool, resolveUserId } from '@/lib/db';

// userEmail-driven access control is a local-dev placeholder; production
// path is described in /api/my-patterns.

// GET /api/projects?userEmail=foo@bar.com
// Returns the caller's projects, most-recently-updated first, with file counts.
export async function GET(request) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  const userEmail = new URL(request.url).searchParams.get('userEmail');
  if (!userEmail) {
    return Response.json({ error: 'userEmail query param required' }, { status: 400 });
  }

  const client = getPool();
  try {
    const userId = await resolveUserId(client, userEmail);
    if (!userId) return Response.json({ projects: [] });

    const { rows } = await client.query(
      `SELECT
         p.id,
         p.name,
         p.created_at,
         p.updated_at,
         COUNT(pf.id)::int AS file_count
       FROM projects p
       LEFT JOIN project_files pf ON pf.project_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
      [userId],
    );
    return Response.json({ projects: rows });
  } catch (err) {
    console.error('[api/projects GET] query error:', err);
    return Response.json({ error: err.message ?? 'unknown error' }, { status: 500 });
  }
}

// POST /api/projects  { userEmail, name }
export async function POST(request) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const userEmail = body?.userEmail;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!userEmail) return Response.json({ error: 'userEmail required' }, { status: 400 });
  if (!name) return Response.json({ error: 'name required' }, { status: 400 });

  const client = getPool();
  try {
    const userId = await resolveUserId(client, userEmail);
    if (!userId) {
      return Response.json({ error: `no user with email ${userEmail}` }, { status: 404 });
    }
    const { rows } = await client.query(
      `INSERT INTO projects (name, user_id)
       VALUES ($1, $2)
       RETURNING id, name, created_at, updated_at`,
      [name, userId],
    );
    return Response.json({ project: { ...rows[0], file_count: 0 } }, { status: 201 });
  } catch (err) {
    console.error('[api/projects POST] insert error:', err);
    return Response.json({ error: err.message ?? 'unknown error' }, { status: 500 });
  }
}
