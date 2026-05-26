import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Proxy to local Strapi at localhost:1337 (seeded from prod via the seeder
// script — see /backend/data/seed/ and scripts/seed-local-strapi.mjs).
//
// Falls back to prod (api.brand.dev.egsync.com) when local Strapi isn't
// running, using STRAPI_API_PROD_TOKEN. Both tokens live in .env.local,
// server-side only — never shipped to the browser.

const LOCAL_API = (process.env.NEXT_PUBLIC_STRAPI_API_URL ?? 'http://localhost:1337/api');
const PROD_API  = 'https://api.brand.dev.egsync.com/api';
const LOCAL_TOKEN = process.env.STRAPI_API_TOKEN;
const PROD_TOKEN  = process.env.STRAPI_API_PROD_TOKEN;

// Strapi returns image URLs as relative paths like "/uploads/foo.svg".
// Prepend the host so the browser can load them from the right origin.
function absoluteUrl(url, base) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const origin = base.replace(/\/api\/?$/, '');
  return origin + url;
}

function rewriteUrls(value, base) {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const v of value) rewriteUrls(v, base);
    return;
  }
  for (const k of Object.keys(value)) {
    if (k === 'url' && typeof value[k] === 'string') {
      value[k] = absoluteUrl(value[k], base);
    } else {
      rewriteUrls(value[k], base);
    }
  }
}

const POPULATE_PARAMS = [
  'populate[0]=Assets',
  'populate[1]=Assets.Logo',
  'populate[2]=Assets.LightLogo',
  'populate[3]=Assets.LightLogo.Horizontal',
  'populate[4]=Assets.DarkLogo',
  'populate[5]=Assets.DarkLogo.Horizontal',
].join('&');

function transformLogo(raw) {
  return {
    id: raw.documentId ?? String(raw.id),
    name: raw.Name,
    colorPalette: raw.ColorPalette,
    assets: {
      // .Logo is the icon mark — single square image. Best for sidebar
      // thumbnails because it's recognizable at small sizes and bg-agnostic.
      logo: raw.Assets?.Logo?.url ?? null,
      light: {
        // "Light" = light-colored logo (for use on dark backgrounds).
        horizontal: raw.Assets?.LightLogo?.Horizontal?.url ?? null,
      },
      dark: {
        // "Dark" = dark-colored logo (for use on light backgrounds — what our
        // sidebar uses, since the sidebar background is white).
        horizontal: raw.Assets?.DarkLogo?.Horizontal?.url ?? null,
      },
    },
  };
}

// Try local Strapi first; fall back to prod if local is unreachable or
// returns no data. Returns the response + which base URL it came from so
// we can rewrite media URLs to absolute paths.
async function fetchLogosPage(query) {
  // Local first
  if (LOCAL_TOKEN) {
    try {
      const res = await fetch(`${LOCAL_API}/logos?${query}`, {
        headers: { Authorization: `Bearer ${LOCAL_TOKEN}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const body = await res.json();
        if (body?.data?.length > 0) return { body, base: LOCAL_API };
      }
    } catch {
      // local Strapi not reachable — fall through
    }
  }
  // Prod fallback
  if (!PROD_TOKEN) {
    throw new Error('Local Strapi unavailable and STRAPI_API_PROD_TOKEN not set');
  }
  const res = await fetch(`${PROD_API}/logos?${query}`, {
    headers: { Authorization: `Bearer ${PROD_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Prod Strapi responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return { body: await res.json(), base: PROD_API };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '1';
  const pageSize = searchParams.get('pageSize') ?? '100';

  const query = `${POPULATE_PARAMS}&pagination%5Bpage%5D=${encodeURIComponent(page)}&pagination%5BpageSize%5D=${encodeURIComponent(pageSize)}`;

  try {
    const { body, base } = await fetchLogosPage(query);

    // Convert any relative /uploads/... URLs to absolute before transforming.
    rewriteUrls(body, base);

    const data = Array.isArray(body?.data) ? body.data.map(transformLogo) : [];
    const totalCount = body?.meta?.pagination?.total ?? data.length;
    return NextResponse.json({ data, totalCount, source: base.includes('localhost') ? 'local' : 'prod' });
  } catch (err) {
    console.error('[api/product-logos] proxy error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Unknown proxy error' },
      { status: 500 },
    );
  }
}
