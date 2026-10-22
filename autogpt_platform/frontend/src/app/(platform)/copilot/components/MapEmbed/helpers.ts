/**
 * Parsing and URL helpers for the chat "map" block.
 *
 * The assistant can emit a fenced block in its markdown reply:
 *
 *   ```map
 *   {"places": [{"name": "Blue Bottle Coffee", "query": "Blue Bottle Coffee, 66 Mint St, San Francisco"}]}
 *   ```
 *
 * The chat renders the first place as a Google Maps Embed (one pin per map is
 * a limit of the Embed API) and lists any further places as plain links.
 */

export interface MapPlace {
  /** Optional display label. Falls back to the query. */
  name?: string;
  /** Free-text place, address, or "lat,lng" understood by Google Maps. */
  query: string;
}

export type MessageSegment =
  | { kind: "text"; text: string }
  | { kind: "map"; places: MapPlace[] };

export const MAX_PLACES = 10;
export const MAX_QUERY_LENGTH = 300;
export const MAX_NAME_LENGTH = 120;

const MAP_FENCE_OPEN = /^```map[ \t]*$/;
const FENCE_CLOSE = /^```[ \t]*$/;
const OTHER_FENCE_OPEN = /^(```+|~~~+)/;

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Accepts `{places: [...]}`, a single `{query, name?}` object, or a bare array.
 * Returns null when nothing usable is found so the caller can fall back to
 * showing the raw block as ordinary markdown.
 */
export function parseMapPlaces(raw: string): MapPlace[] | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  let candidates: unknown[];
  if (Array.isArray(data)) {
    candidates = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    candidates = Array.isArray(obj.places) ? obj.places : [obj];
  } else {
    return null;
  }

  const seen = new Set<string>();
  const places: MapPlace[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as Record<string, unknown>;
    const query = cleanString(item.query ?? item.address, MAX_QUERY_LENGTH);
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const name = cleanString(item.name, MAX_NAME_LENGTH);
    places.push(name ? { name, query } : { query });
    if (places.length >= MAX_PLACES) break;
  }
  return places.length > 0 ? places : null;
}

/**
 * Splits message text into plain-text and map segments.
 *
 * Only complete, valid ```map fences become map segments. An unclosed fence
 * (still streaming), invalid JSON, or a ```map example nested inside another
 * code fence all stay as text, so nothing is ever swallowed.
 */
export function splitMapBlocks(text: string): MessageSegment[] {
  if (!text.includes("```map")) return [{ kind: "text", text }];

  const lines = text.split("\n");
  const segments: MessageSegment[] = [];
  let buffer: string[] = [];
  let otherFence: string | null = null;

  const flush = () => {
    if (buffer.length === 0) return;
    segments.push({ kind: "text", text: buffer.join("\n") });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (otherFence !== null) {
      buffer.push(line);
      if (line.trim().startsWith(otherFence)) otherFence = null;
      continue;
    }

    if (MAP_FENCE_OPEN.test(line)) {
      let close = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (FENCE_CLOSE.test(lines[j])) {
          close = j;
          break;
        }
      }
      if (close !== -1) {
        const places = parseMapPlaces(lines.slice(i + 1, close).join("\n"));
        if (places) {
          flush();
          segments.push({ kind: "map", places });
          i = close;
          continue;
        }
      }
      buffer.push(line);
      continue;
    }

    const fence = OTHER_FENCE_OPEN.exec(line.trim());
    if (fence) otherFence = fence[1];
    buffer.push(line);
  }
  flush();
  return segments;
}

export function buildEmbedUrl(query: string, apiKey: string): string {
  return (
    "https://www.google.com/maps/embed/v1/place" +
    `?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}`
  );
}

export function buildMapsLink(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
