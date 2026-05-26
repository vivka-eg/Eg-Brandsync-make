import { Pool } from 'pg';

// Shared Postgres pool + small helpers used by every Brandsync Make API
// route (projects, project files, my-patterns, generate). All callers
// connect to the same Supabase via DATABASE_URL, so one pool is enough
// — and lazy-init means missing env at build time doesn't crash.

let pool;
export function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export async function resolveUserId(client, userEmail) {
  const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [userEmail]);
  return rows[0]?.id ?? null;
}

export async function userOwnsProject(client, projectId, userId) {
  const { rows } = await client.query(
    'SELECT 1 FROM projects WHERE id = $1 AND user_id = $2',
    [projectId, userId],
  );
  return rows.length > 0;
}
