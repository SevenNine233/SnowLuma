// Bounded in-memory cache of recently seen image / record media elements.
//
// The OneBot `get_image` and `get_record` APIs take back the `data.file` that
// was emitted earlier in a message segment and expect to receive the
// corresponding URL (and, ideally, file size / name / path). SnowLuma emits
// minimal `{file, url}` segments, so we need a side-channel that records the
// full metadata (and enough context to re-resolve the URL later via OIDB, the
// same way NapCat's `getPttUrl` does).
//
// This cache is deliberately small and lives in memory only — message events
// already get persisted separately in `MessageStore`. Entries are keyed by
// every identifier we might reasonably be asked about: the OneBot `file`
// value, the raw `fileId` / `fileUuid`, and the resolved URL. When the cache
// outgrows its budget, the least-recently-inserted entries are evicted.

import type { MessageElement } from '../bridge/events';

export interface CachedImage {
  /** Primary `data.file` value as exposed in the OneBot segment. */
  file: string;
  /** Last known resolved URL (may be empty if resolution failed). */
  url: string;
  fileSize: number;
  fileName: string;
  subType: number;
  summary: string;
  /** Conversation the media originated from (needed for RKey refresh). */
  isGroup: boolean;
  sessionId: number;
  /** Original imageUrl from the MessageElement, used for RKey re-appending. */
  imageUrl: string;
}

export interface CachedRecord {
  /** Primary `data.file` value as exposed in the OneBot segment. */
  file: string;
  /** Raw fileId from the MessageElement (typically the fileUuid). */
  fileId: string;
  /** Last known resolved URL (may be empty if resolution failed). */
  url: string;
  fileSize: number;
  fileName: string;
  duration: number;
  fileHash: string;
  /** OIDB media node used to re-fetch the URL via getPtt*UrlByNode. */
  mediaNode?: MessageElement['mediaNode'];
  /** Conversation the media originated from (group vs private path). */
  isGroup: boolean;
  sessionId: number;
}

interface BoundedMap<V> {
  values: Map<string, V>;
  limit: number;
}

function createBounded<V>(limit: number): BoundedMap<V> {
  return { values: new Map<string, V>(), limit: Math.max(32, limit) };
}

function putBounded<V>(map: BoundedMap<V>, key: string, value: V): void {
  if (!key) return;
  // Re-insert to push the key to the tail of the insertion order (LRU-ish).
  if (map.values.has(key)) map.values.delete(key);
  map.values.set(key, value);
  while (map.values.size > map.limit) {
    const oldest = map.values.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    map.values.delete(oldest);
  }
}

function getBounded<V>(map: BoundedMap<V>, key: string): V | null {
  if (!key) return null;
  return map.values.get(key) ?? null;
}

export class MediaCache {
  private readonly images: BoundedMap<CachedImage>;
  private readonly records: BoundedMap<CachedRecord>;

  constructor(maxEntries = 1024) {
    this.images = createBounded(maxEntries);
    this.records = createBounded(maxEntries);
  }

  rememberImage(info: CachedImage): void {
    if (!info.file && !info.url && !info.fileName) return;
    // Store under every plausible lookup key so callers can pass back any of
    // {file, fileName, url} from the segment they previously received.
    for (const key of dedupe([info.file, info.fileName, info.url])) {
      putBounded(this.images, key, info);
    }
  }

  rememberRecord(info: CachedRecord): void {
    if (!info.file && !info.url && !info.fileId && !info.fileName) return;
    for (const key of dedupe([info.file, info.fileName, info.fileId, info.url])) {
      putBounded(this.records, key, info);
    }
  }

  findImage(key: string): CachedImage | null {
    return getBounded(this.images, key);
  }

  findRecord(key: string): CachedRecord | null {
    return getBounded(this.records, key);
  }

  /** Replace the cached URL on an image entry (after RKey refresh, etc.). */
  updateImageUrl(key: string, url: string): void {
    const cached = this.findImage(key);
    if (!cached || !url || cached.url === url) return;
    const next: CachedImage = { ...cached, url };
    this.rememberImage(next);
  }

  /** Replace the cached URL on a record entry after an on-demand re-fetch. */
  updateRecordUrl(key: string, url: string): void {
    const cached = this.findRecord(key);
    if (!cached || !url || cached.url === url) return;
    const next: CachedRecord = { ...cached, url };
    this.rememberRecord(next);
  }

  /** Count currently cached entries (test helper). */
  get size(): { images: number; records: number } {
    return { images: this.images.values.size, records: this.records.values.size };
  }
}

function dedupe(values: (string | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
