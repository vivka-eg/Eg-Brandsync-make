import { getPool } from '@/lib/db';

// Access control: caller passes `?userEmail=` and we scope to that user.
// NOT secure — replace with Keycloak JWT verification (read from the
// Authorization header) or Supabase RLS before any non-local deploy.

export async function GET(request) {
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  const userEmail = new URL(request.url).searchParams.get('userEmail');
  if (!userEmail) {
    return Response.json({ error: 'userEmail query param required' }, { status: 400 });
  }

  try {
    const { rows } = await getPool().query(
      `SELECT
         ce.id, ce.slug, ce.type, ce.path, ce.content, ce.user_id, ce.created_at,
         u.email AS created_by_email,
         u.name  AS created_by_name
       FROM corpus_entries ce
       JOIN users u ON u.id = ce.user_id
       WHERE u.email = $1
       ORDER BY ce.created_at DESC`,
      [userEmail],
    );
    return Response.json({ patterns: rows });
  } catch (err) {
    console.error('[api/my-patterns] query error:', err);
    return Response.json({ error: err.message ?? 'unknown error' }, { status: 500 });
  }
}
