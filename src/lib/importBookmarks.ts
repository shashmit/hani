import { domainOf, normalizeUrl } from '@/lib/linkPreview';
import { cleanTag } from '@/store/notes';

/** One link read from an import file, before it is matched against what's saved. */
export type ImportedLink = {
  url: string;
  title: string;
  excerpt: string;
  note: string;
  tags: string[];
  /** Collection path, outermost first. Empty = Unsorted. */
  path: string[];
  cover?: string;
  favorite: boolean;
  createdAt?: number;
};

export type ImportResult = { links: ImportedLink[]; skipped: number };

/** RFC 4180-style CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

type Raw = Record<string, unknown>;

/** First non-empty value among several possible field names (case-insensitive). */
function pick(o: Raw, ...names: string[]): unknown {
  for (const n of names) {
    const v = o[n];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

function toTags(v: unknown): string[] {
  const list = Array.isArray(v) ? v.map(str) : str(v).split(/[,;]/);
  return [...new Set(list.map(cleanTag).filter(Boolean))];
}

function toPath(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.map(str) : str(v).split(/\s*\/\s*|\s*>\s*/);
  const path = raw.map((s) => s.trim()).filter(Boolean);
  // "Unsorted" in a Raindrop export means no collection.
  return path.length === 1 && /^unsorted$/i.test(path[0]) ? [] : path;
}

function toTime(v: unknown): number | undefined {
  if (typeof v === 'number') return v < 1e11 ? v * 1000 : v;
  const s = str(v);
  if (!s) return undefined;
  if (/^\d+$/.test(s)) return toTime(Number(s));
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : t;
}

const toBool = (v: unknown) => v === true || v === 1 || /^(true|1|yes)$/i.test(str(v));

/** Turns one loosely-shaped record (lower-cased keys) into a link, or null without a usable URL. */
function toLink(o: Raw, inheritedPath: string[] = []): ImportedLink | null {
  const url = normalizeUrl(str(pick(o, 'url', 'link', 'href', 'uri')));
  if (!url) return null;
  const folder = pick(o, 'folder', 'collection', 'path', 'category');
  const folderName =
    folder && typeof folder === 'object' && !Array.isArray(folder) ? pick(lower(folder as Raw), 'title', 'name') : folder;
  const path = toPath(folderName);
  return {
    url,
    title: str(pick(o, 'title', 'name')) || domainOf(url),
    excerpt: str(pick(o, 'excerpt', 'description', 'summary')),
    note: str(pick(o, 'note', 'notes', 'comment')),
    tags: toTags(pick(o, 'tags', 'tag', 'labels')),
    path: path.length ? path : inheritedPath,
    cover: str(pick(o, 'cover', 'image', 'thumbnail')) || undefined,
    favorite: toBool(pick(o, 'favorite', 'favourite', 'important', 'starred')),
    createdAt: toTime(pick(o, 'created', 'createdat', 'date', 'added', 'add_date', 'dateadded', 'time_added')),
  };
}

const lower = (o: Raw): Raw => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase().trim(), v]));

/** Walks JSON of any reasonable shape: arrays of links, { items | bookmarks | links }, or folder trees with children. */
function walkJson(node: unknown, path: string[], out: ImportedLink[], counter: { skipped: number }) {
  if (Array.isArray(node)) {
    for (const n of node) walkJson(n, path, out, counter);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const o = lower(node as Raw);
  const hasUrl = pick(o, 'url', 'link', 'href', 'uri') !== undefined;
  if (hasUrl) {
    const link = toLink(o, path);
    if (link) out.push(link);
    else counter.skipped++;
  }
  const name = str(pick(o, 'title', 'name'));
  const inner = !hasUrl && name ? [...path, name] : path;
  for (const key of ['items', 'bookmarks', 'links', 'children', 'collections', 'folders', 'data']) {
    if (o[key] !== undefined) walkJson(o[key], key === 'children' || key === 'items' || key === 'bookmarks' || key === 'links' ? inner : path, out, counter);
  }
}

/**
 * Reads links from an export file. CSV needs a header row with at least a url column
 * (Raindrop's export works as is: title, note, excerpt, url, folder, tags, created,
 * cover, favorite). JSON can be a list of links or a tree of folders.
 * Throws an Error with a plain-language message when the file can't be used.
 */
export function parseImport(text: string, filename = ''): ImportResult {
  const body = text.trim();
  if (!body) throw new Error('That file is empty.');
  const looksJson = /\.json$/i.test(filename) || body.startsWith('{') || body.startsWith('[');

  if (looksJson) {
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error("That file isn't valid JSON.");
    }
    const links: ImportedLink[] = [];
    const counter = { skipped: 0 };
    walkJson(data, [], links, counter);
    if (links.length === 0) throw new Error('No links found. Each link needs a "url" (or "link") field.');
    return { links, skipped: counter.skipped };
  }

  const rows = parseCsv(body);
  if (rows.length < 2) throw new Error('No rows found. The first line should name the columns, e.g. title,url,tags.');
  const head = rows[0].map((h) => h.toLowerCase().trim());
  if (!head.some((h) => ['url', 'link', 'href', 'uri'].includes(h))) {
    throw new Error('No "url" column found. The first line should name the columns, e.g. title,url,tags.');
  }
  const links: ImportedLink[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const link = toLink(Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
    if (link) links.push(link);
    else skipped++;
  }
  if (links.length === 0) throw new Error('No usable links found in that file.');
  return { links, skipped };
}
