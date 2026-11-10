import {site} from './config.js';
import {contentPagePath} from './contentPages.js';
import {pageIsVisible} from './pageVisibility.js';

// Production domain. Vercel has no NEXT_PUBLIC_SITE_URL, so this value is what
// canonicals, the sitemap and Open Graph URLs use on 967ye.com.
export const DEFAULT_SITE_ORIGIN = 'https://967ye.com';

function publicOrigin(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
        !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') ||
        url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {return null;}
}

/** Canonicals always identify the production site, including in Preview. */
export function getSiteOrigin(env = process.env) {
  const configured = publicOrigin(env.NEXT_PUBLIC_SITE_URL);
  const previewOrigin = publicOrigin(env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '');
  if (configured && !(env.VERCEL_ENV !== 'production' && configured === previewOrigin)) return configured;
  return DEFAULT_SITE_ORIGIN;
}

export function isIndexableDeployment(env = process.env) {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === 'production';
  return env.NODE_ENV === 'production';
}

export function siteUrl(path = '/', env = process.env) {
  // A canonical path cannot change the site origin or retain filter parameters.
  const origin = getSiteOrigin(env);
  const normalized = String(path).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\\/g, '/');
  const url = new URL('/' + normalized.replace(/^\/+/, ''), origin);
  if (url.origin !== origin) return `${origin}/`;
  url.search = '';
  url.hash = '';
  return url.href;
}

export function detailPath(section, slug) {
  return `/${section}/${encodeURIComponent(String(slug))}`;
}

export function absoluteMediaUrl(value, env = process.env) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value, getSiteOrigin(env));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch {return undefined;}
}

// Generated share cards (/share/…) are always 1200×630 PNG.
const isShareCard = value => typeof value === 'string' && value.startsWith('/share/');

export function pageMetadata({title, description = site.description, path = '/', image, type = 'website', noindex = false, nofollow = false}, env = process.env) {
  title = typeof title === 'string' && title.trim() ? title.trim() : site.name;
  description = typeof description === 'string' && description.trim() ? description.trim() : site.description;
  const index = isIndexableDeployment(env) && !noindex;
  const canonical = siteUrl(path, env);
  const shareTitle = `${title} | ${site.name}`;
  const shareImage = absoluteMediaUrl(image, env) || siteUrl('/images/og.png', env);
  return {
    title, description,
    alternates: {canonical},
    robots: {index, follow: !nofollow, ...(index ? {googleBot: {index: true, follow: true, 'max-image-preview': 'large'}} : {})},
    openGraph: {title: shareTitle, description, url: canonical, siteName: site.name, type, locale: 'ar_YE', images: [{url: shareImage, alt: title, ...(isShareCard(image) ? {width: 1200, height: 630, type: 'image/png'} : {})}]},
    twitter: {card: 'summary_large_image', title: shareTitle, description, images: [shareImage]},
  };
}

export function isPublicRecord(record) {
  return Boolean(record) && record.is_published !== false && !record.isDemo && !record.is_demo;
}

export function hasIndexableIndicator(indicator) {
  return isPublicRecord(indicator) && Boolean(indicator.name && (indicator.definition || indicator.short_description));
}

export function validLastModified(value) {
  if (!value || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

export function robotsPolicy(env = process.env) {
  if (!isIndexableDeployment(env)) return {rules: [{userAgent: '*', disallow: '/'}]};
  // Keep the existing wildcard training policy. Search-specific groups must
  // repeat the private-path exclusions because specific groups replace '*'.
  const disallow = ['/admin', '/api/', '/account', '/school/dashboard', '/login', '/register', '/forgot-password', '/update-password', '/auth/'];
  return {
    rules: [
      {userAgent: '*', allow: '/', disallow},
      {userAgent: ['OAI-SearchBot', 'PerplexityBot'], allow: '/', disallow},
    ],
    sitemap: siteUrl('/sitemap.xml', env),
  };
}

export function buildSitemap({issues = [], companies = [], professionals = [], universities = [], medicalCenters = [], figures = [], statSections = [], statIndicators = [], works = [], history=[],market=null,debates=[],contentPages=[],places=[],school=[],pageVisibility={}}, env = process.env) {
  if (!isIndexableDeployment(env)) return [];
  const entry = (path, date) => ({url: siteUrl(path, env), ...(validLastModified(date) ? {lastModified: validLastModified(date)} : {})});
  const indicators = statIndicators.filter(hasIndexableIndicator);
  const populatedDomains = new Set(indicators.map(indicator => indicator.domain?.slug).filter(Boolean));
  const paths = ['/', '/explore', '/works', '/debates', '/contribute', '/magazine', '/yemen-map', '/yemen-map/compare', '/yemeni-figures', '/yemen-history', '/games', '/games/quiz', '/games/place', '/games/timeline', '/games/map', '/games/leaderboard', '/games/achievements', '/school', '/school/writing', '/school/courses/musnad', '/school/courses/musnad/1', '/school/courses/musnad/2', '/school/courses/musnad/3', '/school/writing/musnad/alphabet', '/school/writing/musnad/practice', '/school/courses/musnad/4', '/school/courses/musnad/5', '/school/courses/musnad/6', '/school/courses/musnad/7', '/school/courses/musnad/8', '/school/courses/musnad/9', '/school/courses/musnad/10', '/school/courses/musnad/11', '/school/courses/musnad/12', '/school/courses/arud', '/school/courses/arud/1', '/school/courses/arud/2', '/school/courses/arud/3', '/school/courses/arud/4', '/games/who', '/games/bigger', '/games/connect', '/games/yemenword', '/games/object', '/yemeni-products', '/professionals', '/universities', '/medical-centers', '/yemen-in-numbers', '/yemen-ranking', '/services', '/services/exchange-rates', '/services/food-prices'];
  if (indicators.some(indicator => indicator.values?.length > 1)) paths.push('/yemen-in-numbers/timeline');
  const result = [
    ...debates.filter(d=>['published','archived'].includes(d.publication_status)).map(d=>entry(detailPath('debates',d.slug),d.updated_at)),
    ...debates.filter(d=>['published','archived'].includes(d.publication_status)).flatMap(d=>(d.participants||[]).filter(p=>p.speaker?.is_published).map(p=>entry(detailPath('debates/speakers',p.speaker.slug)))),
    ...paths.map(path => entry(path)),
    ...contentPages.filter(page=>page.isPublished!==false).map(page=>entry(contentPagePath(page),page.updatedAt)),
    ...statSections.flatMap(section => (section.domains || []).filter(domain => populatedDomains.has(domain.slug)).map(domain => entry(detailPath('yemen-in-numbers', domain.slug)))),
    ...indicators.map(indicator => entry(detailPath('yemen-in-numbers/indicator', indicator.slug), indicator.updated_at)),
    ...figures.filter(isPublicRecord).map(figure => entry(detailPath('yemeni-figures', figure.slug))),
    ...history.filter(item=>item.isPublished!==false).map(item=>entry(detailPath('yemen-history',item.slug))),
    // «سوق 967»: the home, the terms and live listings (fetched only once the section is open).
    ...(Array.isArray(market)?[entry('/market'),entry('/market/terms')]:[]),
    ...(market||[]).filter(item=>/^\d{1,12}$/.test(String(item.number))).map(item=>entry('/market/'+item.number,item.updated_at)),
    // Every published school course and its lessons (they were a hand-kept list of two courses).
    ...['/school/nature','/school/logic','/school/civic'].map(path=>entry(path)),
    ...school.filter(course=>/^[a-z][a-z0-9-]{2,39}$/.test(course?.slug||'')).flatMap(course=>[entry('/school/courses/'+course.slug),...(course.lessons||[]).filter(index=>Number.isInteger(index)&&index>=0&&index<12).map(index=>entry('/school/courses/'+course.slug+'/'+(index+1)))]),
    ...places.filter(path=>typeof path==='string'&&/^\/yemen-map\/(governorates|districts)\/YE\d{2}(\d{2})?$/.test(path)).map(path=>entry(path)),
    ...works.filter(work=>isPublicRecord(work)&&!work.debate_slug).map(work => entry(detailPath('works', work.slug), work.published_at)),
    ...professionals.filter(isPublicRecord).map(person => entry(detailPath('professionals', person.id))),
    ...universities.filter(isPublicRecord).map(item => entry(detailPath('universities', item.id), item.updatedAt||item.verifiedAt)),
    ...medicalCenters.filter(isPublicRecord).map(item => entry(detailPath('medical-centers', item.id), item.updatedAt||item.verifiedAt)),
    ...companies.filter(isPublicRecord).map(company => entry(detailPath('yemeni-products', company.id))),
    ...issues.filter(isPublicRecord).map(issue => entry(detailPath('magazine', issue.slug), issue.issue_date)),
  ];
  return [...new Map(result.map(item => [item.url, item])).values()].filter(item=>pageIsVisible(new URL(item.url).pathname,pageVisibility,contentPages));
}
