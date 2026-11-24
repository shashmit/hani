import type { BookmarkType } from '@/store/bookmarks';

/**
 * Reads a page's title, description, preview image and icon straight from the page
 * itself (Open Graph / meta tags). No third-party preview service is involved.
 */

export type LinkPreview = {
  title: string;
  excerpt: string;
  cover?: string;
  icon?: string;
  type: BookmarkType;
};

/** Turn what the user typed or pasted into a full http(s) URL, or null if it isn't one. */
export function normalizeUrl(input: string): string | null {
  let s = input.trim();
  // A pasted paragraph that contains a link: take the first link in it.
  const found = s.match(/https?:\/\/[^\s<>"']+/i);
  if (found) s = found[0];
  if (!/^https?:\/\//i.test(s)) {
    if (!/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(s)) return null;
    s = `https://${s}`;
  }
  return /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(s) ? s.replace(/[).,;]+$/, '') : null;
}

/** "https://www.example.com/a" → "example.com" */
export function domainOf(url: string) {
  const m = url.match(/^https?:\/\/([^/?#:]+)/i);
  return (m ? m[1] : url).replace(/^www\./i, '').toLowerCase();
}

function originOf(url: string) {
  const m = url.match(/^(https?:\/\/[^/?#]+)/i);
  return m ? m[1] : url;
}

/** Make a link found in the page absolute. */
function resolve(href: string | undefined, base: string) {
  if (!href) return undefined;
  const h = decode(href.trim());
  if (/^https?:\/\//i.test(h)) return h;
  if (h.startsWith('//')) return `https:${h}`;
  if (h.startsWith('/')) return originOf(base) + h;
  if (/^(data|javascript):/i.test(h)) return undefined;
  return `${base.replace(/[?#].*$/, '').replace(/\/[^/]*$/, '')}/${h}`;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9#]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|epub)(\?.*)?$/i;
const VIDEO_HOST = /(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|tiktok\.com|dailymotion\.com)$/i;

export function guessType(url: string, ogType?: string): BookmarkType {
  if (IMAGE_EXT.test(url)) return 'image';
  if (DOC_EXT.test(url)) return 'document';
  if (VIDEO_HOST.test(domainOf(url)) || ogType?.startsWith('video')) return 'video';
  if (ogType === 'article') return 'article';
  return 'link';
}

export async function fetchPreview(url: string, signal?: AbortSignal): Promise<LinkPreview> {
  const fallback: LinkPreview = { title: domainOf(url), excerpt: '', type: guessType(url) };
  if (fallback.type === 'image') return { ...fallback, cover: url };

  const res = await fetch(url, { signal, headers: { Accept: 'text/html,application/xhtml+xml' } });
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.startsWith('image/')) return { ...fallback, type: 'image', cover: url };
  if (!contentType.includes('html')) return fallback;

  // Everything we need sits in <head>; don't parse megabytes of body.
  const html = (await res.text()).slice(0, 400_000);
  const head = html.split(/<\/head>/i)[0];

  const meta: Record<string, string> = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? '').toLowerCase();
    const content = attr(tag, 'content');
    if (key && content && !(key in meta)) meta[key] = content;
  }

  let icon: string | undefined;
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    if (rel.includes('apple-touch-icon')) {
      icon = attr(tag, 'href');
      break;
    }
    if (!icon && rel.split(/\s+/).includes('icon')) icon = attr(tag, 'href');
  }

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = decode(meta['og:title'] ?? meta['twitter:title'] ?? titleTag ?? '') || fallback.title;
  const excerpt = decode(meta['og:description'] ?? meta['twitter:description'] ?? meta.description ?? '');
  const finalUrl = res.url || url;

  return {
    title,
    excerpt: excerpt.slice(0, 300),
    cover: resolve(meta['og:image'] ?? meta['og:image:url'] ?? meta['twitter:image'], finalUrl),
    icon: resolve(icon, finalUrl) ?? `${originOf(finalUrl)}/favicon.ico`,
    type: guessType(finalUrl, meta['og:type']),
  };
}
