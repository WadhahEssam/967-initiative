// One image host/path policy, shared by next.config.mjs (what the optimizer
// accepts) and by the components that decide whether to ask the optimizer.
// If these two disagree, next/image throws during render and takes the whole
// route down, so both sides must read the same list. Plain ESM, no imports.

export function imageRemotePatterns(supabaseUrl) {
  const patterns = [
    {protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**'},
    {protocol: 'https', hostname: 'commons.wikimedia.org', pathname: '/wiki/Special:FilePath/**'},
    // SVG renderings (Special:Redirect/file/<name>.svg&width=…): see commonsFileAt in lib/media.js.
    // (next/image matches `search` exactly, so the path is allowed with any query; the optimizer
    // still refuses anything that does not come back as an image.)
    {protocol: 'https', hostname: 'commons.wikimedia.org', pathname: '/w/index.php'},
    {protocol: 'https', hostname: 'upload.wikimedia.org', pathname: '/wikipedia/commons/**'},
    // Verified public imagery from the producer's own official catalog.
    {protocol: 'https', hostname: 'www.nadfood.com', pathname: '/products/**'},
    {protocol: 'https', hostname: 'nadfood.com', pathname: '/products/**'},
    {protocol: 'https', hostname: 'www.nadfood.com', pathname: '/en/images/about/**'},
  ];
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      patterns.push({protocol: url.protocol.replace(':', ''), hostname: url.hostname, pathname: '/storage/v1/object/public/**'});
    } catch {}
  }
  return patterns;
}

function pathMatches(pattern, pathname) {
  if (pattern.endsWith('/**')) return pathname.startsWith(pattern.slice(0, -2));
  return pathname === pattern;
}

// True only when next/image would accept this remote URL for optimization.
export function matchesImagePolicy(value, patterns) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.username || url.password || url.port) return false;
  return patterns.some(item => url.protocol === item.protocol + ':' && url.hostname === item.hostname && pathMatches(item.pathname, url.pathname));
}
