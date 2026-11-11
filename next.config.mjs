import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {imageRemotePatterns} from './lib/imagePolicy.js';
import htmlBots from 'next/dist/shared/lib/router/utils/html-bots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Shared with lib/media.js canOptimizeImage(): one host/path policy.
const remotePatterns = imageRemotePatterns(process.env.NEXT_PUBLIC_SUPABASE_URL);

const nextConfig = {
  distDir: process.env.NEXT_PREVIEW_LOCAL === '1' ? '.next-preview' : process.env.NEXT_TEAM_PREVIEW === '1' ? '.audit-tools/team-preview' : process.env.NEXT_PHASE4_PREVIEW === '1' ? '.audit-tools/phase4-preview' : process.env.NEXT_PRELAUNCH_DEBATES === '1' ? '.audit-tools/prelaunch-debates' : process.env.NEXT_TASK_PREVIEW === '1' ? '.audit-tools/task-preview' : process.env.NEXT_VALIDATION_BUILD === '1' ? '.next-validation' : '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  // Extend the installed Next.js defaults, since assigning this option replaces
  // them. Search/answer crawlers receive complete metadata in the HTML head.
  htmlLimitedBots: new RegExp(`${htmlBots.HTML_LIMITED_BOT_UA_RE.source}|OAI-SearchBot|PerplexityBot|ChatGPT-User|Perplexity-User`, 'i'),
  outputFileTracingRoot: __dirname,
  outputFileTracingIncludes: {
    '/yemen-ranking': ['./data/rankings/*.json'],
    '/api/rankings': ['./data/rankings/*.json'],
    '/api/admin/rankings': ['./data/rankings/*.json'],
  },
  // Optimised images are kept for 7 days (default 60 s, then the source's own max-age, 1 h on
  // Supabase Storage). Uploads never overwrite a path, so a stored image does not change; this
  // stops refetching every image from Supabase hourly and lets phones keep them a week.
  // AVIF first (about a third lighter than WebP for photos), WebP for browsers without it.
  images: {remotePatterns, formats: ['image/avif', 'image/webp'], qualities: [60, 75], minimumCacheTTL: 7 * 24 * 60 * 60},
  // Keep route CSS in per-route files (in import order) instead of merging CSS
  // modules from many routes into shared chunks that every page then downloads.
  experimental: {cssChunking: 'strict'},
  async redirects() {
    return [{source:'/favicon.ico',destination:'/icon-64.png',permanent:true}];
  },
  async headers() {
    return [{source: '/:path*', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'X-Frame-Options', value: 'DENY'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
      {key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"},
      ...(process.env.NODE_ENV === 'production' ? [{key: 'Strict-Transport-Security', value: 'max-age=31536000'}] : []),
      ...(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production' ? [{key: 'X-Robots-Tag', value: 'noindex, nofollow'}] : []),
    ]}, ...['/admin/:path*', '/api/:path*', '/demo/:path*','/account/:path*','/login','/register','/forgot-password','/update-password','/auth/:path*'].map(source => ({source, headers: [
      {key: 'X-Robots-Tag', value: 'noindex, nofollow'},
    ]})),
    // Files in /public are served with max-age=0, so phones re-ask for every font and map file on
    // each visit (one round trip each on slow networks). Their names rarely change; when one must
    // change, give it a new file name.
    {source: '/fonts/:path*', headers: [{key: 'Cache-Control', value: 'public, max-age=2592000'}]},
    {source: '/images/:path*', headers: [{key: 'Cache-Control', value: 'public, max-age=604800'}]},
    {source: '/data/:path*', headers: [{key: 'Cache-Control', value: 'public, max-age=86400'}]}];
  },
};
export default nextConfig;
