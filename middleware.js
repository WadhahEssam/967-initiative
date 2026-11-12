// Emergency maintenance switch, added during the Supabase outage of 2026-11-12.
// While SITE_PAUSED is true, no request reaches the app: visitors see a short notice, /api/* answers
// 503, and /api/health answers 200 so Coolify still switches to the build. Nothing here touches Supabase.
// Normally false. To close the site again in an emergency, set it to true and release.
// Day-to-day protection when Supabase is down is the circuit breaker in lib/supabaseBreaker.js.
import {NextResponse} from 'next/server';

export const SITE_PAUSED = false;

const NOTICE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>967 · صيانة مؤقتة</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111312;color:#ecebe6;font:16px/1.8 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;padding:16px}main{max-width:32rem;text-align:center}h1{font-size:1.4rem;margin:0 0 .5rem}p{margin:0;color:#b9b7ae}</style></head><body><main><h1>الموقع في صيانة مؤقتة</h1><p>نعمل على إصلاح عطل في خدمة البيانات. سيعود 967 خلال وقت قصير، شكرًا لصبرك.</p></main></body></html>`;

export function middleware(request) {
  if (!SITE_PAUSED) return NextResponse.next();
  if (request.nextUrl.pathname === '/api/health') return Response.json({ok: true, paused: true}, {status: 200, headers: {'Cache-Control': 'no-store'}});
  if (request.nextUrl.pathname.startsWith('/api/')) return Response.json({error: 'maintenance'}, {status: 503, headers: {'Cache-Control': 'no-store', 'Retry-After': '600'}});
  return new Response(NOTICE, {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '600'}});
}

// Everything except the built static files (scripts and styles of tabs already open).
export const config = {matcher: ['/((?!_next/static).*)']};
