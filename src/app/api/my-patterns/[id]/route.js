import { getPool } from '@/lib/db';

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// DELETE /api/my-patterns/:id?userEmail=foo@bar.com
// Drops the corpus_entry. project_files FK cascades. Refuses to delete
// entries the caller doesn't own (USING JOIN enforces the email match).
export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  const userEmail = new URL(request.url).searchParams.get('userEmail');
  if (!userEmail) return Response.json({ error: 'userEmail required' }, { status: 400 });

  try {
    const { rowCount } = await getPool().query(
      `DELETE FROM corpus_entries ce
       USING users u
       WHERE ce.id = $1 AND ce.user_id = u.id AND u.email = $2`,
      [id, userEmail],
    );
    if (rowCount === 0) {
      return Response.json({ error: 'pattern not found or not yours' }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch (err) {
    console.error('[api/my-patterns/[id] DELETE] error:', err);
    return Response.json({ error: err.message ?? 'unknown error' }, { status: 500 });
  }
}

// PATCH /api/my-patterns/:id  { userEmail, slug }
// Renames a user's pattern. The slug doubles as the display name in the
// sidebar. Slug + path are normalized server-side. Conflict on
// (slug, type, org_id, user_id) returns 409 so the UI can prompt again.
export async function PATCH(request, { params }) {
  const { id } = await params;
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'invalid JSON body' }, { status: 400 }); }

  const userEmail = body?.userEmail;
  const slug = slugify(body?.slug);
  if (!userEmail) return Response.json({ error: 'userEmail required' }, { status: 400 });
  if (!slug) return Response.json({ error: 'slug required' }, { status: 400 });

  try {
    const { rows } = await getPool().query(
      `UPDATE corpus_entries ce
       SET slug = $1,
           path = 'corpus/patterns/' || $1 || '.md',
           updated_at = now()
       FROM users u
       WHERE ce.id = $2 AND ce.user_id = u.id AND u.email = $3
       RETURNING ce.id, ce.slug, ce.type, ce.path, ce.content, ce.user_id, ce.updated_at`,
      [slug, id, userEmail],
    );
    if (rows.length === 0) {
      return Response.json({ error: 'pattern not found or not yours' }, { status: 404 });
    }
    return Response.json({ pattern: rows[0] });
  } catch (err) {
    // 23505 = unique_violation on the (slug, type, org_id, user_id) index
    if (err.code === '23505') {
      return Response.json({ error: 'You already have a pattern with that name.' }, { status: 409 });
    }
    console.error('[api/my-patterns/[id] PATCH] error:', err);
    return Response.json({ error: err.message ?? 'unknown error' }, { status: 500 });
  }
}
