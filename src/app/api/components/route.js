import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Proxies the Strapi components content type. Tries local Strapi
// (http://localhost:1337) first using STRAPI_API_TOKEN; if that's not
// running OR returns no data, falls back to prod
// (api.brand.dev.egsync.com) with STRAPI_API_PROD_TOKEN. Same shape as
// /api/product-logos.
//
//   GET /api/components             → sidebar list  [{ id, title }]
//   GET /api/components?name=<name> → full component (incl. CodeExamples)
//
// Note: the existing @/api/design-system client deliberately excludes
// CodeExamples from its populate spec in non-"dev" env. This proxy ALWAYS
// populates CodeExamples because the brandsync-make drawer needs them for
// live previews.

const LOCAL_API = process.env.NEXT_PUBLIC_STRAPI_API_URL ?? 'http://localhost:1337/api';
const PROD_API  = 'https://api.brand.dev.egsync.com/api';
const LOCAL_TOKEN = process.env.STRAPI_API_TOKEN;
const PROD_TOKEN  = process.env.STRAPI_API_PROD_TOKEN;

// Component-list populate — flat dot-path syntax (the bracketed version errored
// on ComponentRel.Image). Returns ComponentItem.{ComponentName, Category,
// ComponentRel.documentId/Title}.
const LIST_POPULATE = 'populate=ComponentItem.ComponentRel';

// Component-detail populate — every field the drawer might want to render.
// Mirrors `singleComponent` in src/strapi/populate.js but adds CodeExamples
// unconditionally.
const DETAIL_POPULATE = [
  'populate[0]=Image',
  'populate[1]=Overview',
  'populate[2]=Specification',
  'populate[3]=Usage',
  'populate[4]=Guidelines',
  'populate[5]=Accessiblity',
  'populate[6]=CodeExamples',
].join('&');

// Run a Strapi request through both bases. Returns the first 200 response
// that yields data; surfaces the last error if both fail.
async function fetchWithFallback(buildPath) {
  const errors = [];

  // Local first.
  if (LOCAL_TOKEN) {
    try {
      const res = await fetch(`${LOCAL_API}/${buildPath}`, {
        headers: { Authorization: `Bearer ${LOCAL_TOKEN}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.data?.length > 0) return { body, source: 'local' };
        // 200 but empty — fall through to prod in case local is missing
        // this entry. Don't treat as error.
      } else {
        errors.push(`local ${res.status}`);
      }
    } catch (e) {
      errors.push(`local ${e.message}`);
    }
  }

  // Prod fallback.
  if (!PROD_TOKEN) {
    throw new Error(`Local Strapi unavailable and STRAPI_API_PROD_TOKEN not set. ${errors.join('; ')}`);
  }
  const res = await fetch(`${PROD_API}/${buildPath}`, {
    headers: { Authorization: `Bearer ${PROD_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`local + prod both failed (${errors.join('; ')}; prod ${res.status}: ${text.slice(0, 120)})`);
  }
  const body = await res.json();
  return { body, source: 'prod' };
}

async function fetchList() {
  const { body } = await fetchWithFallback(`component-lists?${LIST_POPULATE}&pagination%5BpageSize%5D=100`);
  return (body?.data ?? [])
    .map(row => {
      const item = row?.ComponentItem;
      if (!item) return null;
      const id = item.ComponentRel?.documentId ?? item.ComponentName;
      const title = item.ComponentName;
      if (!id || !title) return null;
      return { id, title, category: item.Category ?? null };
    })
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function fetchByName(name) {
  const encName = encodeURIComponent(name);
  const { body } = await fetchWithFallback(
    `components?filters%5BTitle%5D%5B%24eq%5D=${encName}&${DETAIL_POPULATE}&pagination%5BpageSize%5D=1`,
  );
  return body?.data?.[0] ?? null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  try {
    if (name) {
      const component = await fetchByName(name);
      if (!component) {
        return NextResponse.json({ error: `Component "${name}" not found` }, { status: 404 });
      }
      return NextResponse.json(component);
    } else {
      const list = await fetchList();
      return NextResponse.json(list);
    }
  } catch (err) {
    console.error('[api/components] proxy error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Unknown proxy error' },
      { status: 500 },
    );
  }
}
