import {imageRemotePatterns, matchesImagePolicy} from './imagePolicy.js';
/**
 * Recognise supported public media URLs without trusting the submitted URL as
 * an iframe source. Only embed URLs assembled for known providers are used.
 */
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);
const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const FACEBOOK_HOSTS = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.watch']);

export function safeExternalUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function parseMediaUrl(value) {
  const externalUrl = safeExternalUrl(value);
  if (!externalUrl) return {kind: 'external', embedUrl: null, thumbnailUrl: null, externalUrl: null, ratio: 'landscape'};
  const url = new URL(externalUrl);
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    const id = host.endsWith('youtu.be') ? parts[0] : (parts[0] === 'watch' ? url.searchParams.get('v') : ['shorts', 'live', 'embed', 'v'].includes(parts[0]) ? parts[1] : null);
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return {
        kind: 'youtube', externalUrl, ratio: 'landscape',
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }

  if (INSTAGRAM_HOSTS.has(host) && ['reel', 'p', 'tv'].includes(parts[0]) && /^[a-zA-Z0-9_-]{5,30}$/.test(parts[1] || '')) {
    return {
      kind: 'instagram', externalUrl, ratio: 'portrait', thumbnailUrl: null,
      embedUrl: `https://www.instagram.com/${parts[0]}/${parts[1]}/embed/`,
    };
  }

  const tikTokIndex = parts.findIndex(p => p === 'video');
  if (TIKTOK_HOSTS.has(host) && tikTokIndex !== -1 && /^\d{12,25}$/.test(parts[tikTokIndex + 1] || '')) {
    return {
      kind: 'tiktok', externalUrl, ratio: 'portrait', thumbnailUrl: null,
      embedUrl: `https://www.tiktok.com/embed/v2/${parts[tikTokIndex + 1]}`,
    };
  }

  const vimeoId = parts[0] === 'video' ? parts[1] : parts[0];
  if (VIMEO_HOSTS.has(host) && /^\d{5,15}$/.test(vimeoId || '')) {
    return {
      kind: 'vimeo', externalUrl, ratio: 'landscape', thumbnailUrl: null,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
    };
  }

  if (FACEBOOK_HOSTS.has(host) && host !== 'fb.watch' &&
      ((parts.includes('videos') && /^\d+$/.test(parts[parts.indexOf('videos') + 1] || '')) ||
      (parts[0] === 'watch' && /^\d+$/.test(url.searchParams.get('v') || '')))) {
    // Facebook requires its official plugin URL; its availability depends on
    // whether the original post is public and allows embedding.
    const canonical = new URL(externalUrl);
    canonical.protocol = 'https:';
    return {
      kind: 'facebook', externalUrl, ratio: 'landscape', thumbnailUrl: null,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical.href)}&show_text=false`,
    };
  }

  if (/\.mp4$/i.test(url.pathname)) {
    return {kind: 'video', externalUrl, ratio: 'landscape', thumbnailUrl: null, embedUrl: externalUrl};
  }
  return {kind: 'external', externalUrl, ratio: 'landscape', thumbnailUrl: null, embedUrl: null};
}

export function mediaLabel(kind) {
  return {
    youtube: 'يوتيوب', instagram: 'إنستغرام', tiktok: 'تيك توك',
    vimeo: 'فيميو', facebook: 'فيسبوك', video: 'فيديو', external: 'المنصة الأصلية',
  }[kind] || 'فيديو';
}

export function workThumbnail(work) {
  const explicit = safeImageUrl(work?.thumbnail_url);
  if (explicit) return explicit;
  return parseMediaUrl(work?.external_url).thumbnailUrl;
}

export function safeImageUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\') && !/[\u0000-\u001f]/.test(trimmed)) return trimmed;
  return safeExternalUrl(trimmed);
}

// Uses the same host *and path* policy as next.config.mjs. A URL on an allowed
// host but outside the configured path is delivered unoptimized instead of
// making next/image throw and break the page.
export function canOptimizeImage(value) {
  if (typeof value !== 'string') return false;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
  const safe = safeExternalUrl(value);
  if (!safe) return false;
  // The optimizer refuses SVG (it would answer 400 and the card would show its
  // placeholder); vector images are delivered as-is. A Commons file asked for at a
  // width (?width=) comes back as a PNG rendering, which the optimizer accepts.
  if (/\.svg(?:$|[?#])/i.test(safe) && !isCommonsRendering(safe)) return false;
  return matchesImagePolicy(safe, imageRemotePatterns(process.env.NEXT_PUBLIC_SUPABASE_URL));
}

// ---- Wikimedia Commons (hard to reach from Yemen) ----
// Visitors never load Commons files directly: every Commons picture goes through our own
// server (/_next/image fetches it once and keeps it for 7 days), so a blocked or slow
// Wikimedia does not matter to the reader.
const COMMONS_UPLOAD = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i;
const COMMONS_FILE_PATH = /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^?#]+)/;
const COMMONS_REDIRECT = /^https:\/\/commons\.wikimedia\.org\/w\/index\.php\?title=Special:Redirect\/file\/([^&#]+)/;
function isCommonsRendering(url) {
  return (COMMONS_FILE_PATH.test(url) || COMMONS_REDIRECT.test(url)) && /[?&]width=\d+/.test(url);
}
// Any Commons file URL as a link to its rendering at the given width (an SVG comes back as PNG).
// next/image sends any src whose path ends in .svg straight to the browser, so an SVG uses the
// Special:Redirect form (path /w/index.php), which our optimizer then fetches like any picture.
export function commonsFileAt(url, width = 960) {
  if (typeof url !== 'string') return null;
  const file = url.match(COMMONS_UPLOAD)?.[1] || url.match(COMMONS_FILE_PATH)?.[1] || url.match(COMMONS_REDIRECT)?.[1];
  if (!file) return null;
  if (/\.svg$/i.test(file)) return 'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/' + file + '&width=' + width;
  return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + file + '?width=' + width;
}
// The src to give next/image for a picture that may live on Commons.
export function imageSource(url, width = 1200) {
  return commonsFileAt(url, width) || url;
}
// The next/image widths (defaults: deviceSizes + imageSizes) and the qualities in next.config.
const IMAGE_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];
// For a plain <img>: a remote picture our optimizer may fetch is served from our own address.
// Commons files always are; other allowed hosts too; anything else is returned as it is.
export function servedImageUrl(value, width = 960, quality = 75) {
  const safe = safeImageUrl(value);
  if (!safe) return '';
  const source = commonsFileAt(safe, width) || safe;
  if (source.startsWith('/') || !canOptimizeImage(source)) return safe;
  const size = IMAGE_WIDTHS.find(item => item >= width) || 3840;
  return '/_next/image?url=' + encodeURIComponent(source) + '&w=' + size + '&q=' + (quality === 60 ? 60 : 75);
}
