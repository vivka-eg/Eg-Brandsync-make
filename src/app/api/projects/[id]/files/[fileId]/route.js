import { getPool } from '@/lib/db';

// DELETE /api/projects/:id/files/:fileId?userEmail=foo@bar.com
// Removes the project_file membership row only — the corpus_entry it
// points at stays. Single statement does the ownership check inline:
// the DELETE only fires when the project belongs to the calling user.
export async function DELETE(request, { params }) {
  const { id: projectId, fileId } = await params;
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  const userEmail = new URL(request.url).searchParams.get('userEmail');
  if (!userEmail) return Response.json({ error: 'userEmail required' }, { status: 400 });

  try {
    const { rowCount } = await getPool().query(
      `DELETE FROM project_files pf
       USING projects p, users u
       WHERE pf.id = $1
         AND pf.project_id = $2
         AND pf.project_id = p.id
         AND p.user_id = u.id
         AND u.email = $3`,
      [fileId, projectId, userEmail],
    );
    if (rowCount === 0) {
      return Response.json({ error: 'file not found' }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch (err) {
    console.error('[api/projects/[id]/files/[fileId] DELETE] error:', err);
    return Response.json({ error: err.message ?? 'unknown error' }, { status: 500 });
  }
}
