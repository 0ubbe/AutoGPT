import { describe, expect, it } from "vitest";
import {
  MAX_PLACES,
  buildEmbedUrl,
  buildMapsLink,
  parseMapPlaces,
  splitMapBlocks,
} from "../helpers";

const fence = (body: string) => "```map\n" + body + "\n```";

describe("parseMapPlaces", () => {
  it("accepts {places: [...]}", () => {
    expect(
      parseMapPlaces('{"places":[{"name":"A","query":"1 Main St"}]}'),
    ).toEqual([{ name: "A", query: "1 Main St" }]);
  });

  it("accepts a single object and a bare array", () => {
    expect(parseMapPlaces('{"query":"Eiffel Tower"}')).toEqual([
      { query: "Eiffel Tower" },
    ]);
    expect(parseMapPlaces('[{"query":"a"},{"query":"b"}]')).toEqual([
      { query: "a" },
      { query: "b" },
    ]);
  });

  it("accepts address as an alias for query", () => {
    expect(parseMapPlaces('{"address":"5 Elm St"}')).toEqual([
      { query: "5 Elm St" },
    ]);
  });

  it("drops empty, non-string and duplicate queries", () => {
    expect(
      parseMapPlaces(
        '[{"query":"  "},{"query":5},null,{"query":"X"},{"query":"x"}]',
      ),
    ).toEqual([{ query: "X" }]);
  });

  it("caps the number of places and the query length", () => {
    const many = Array.from({ length: MAX_PLACES + 5 }, (_, i) => ({
      query: `place ${i}`,
    }));
    expect(parseMapPlaces(JSON.stringify(many))).toHaveLength(MAX_PLACES);
    const long = parseMapPlaces(JSON.stringify({ query: "a".repeat(1000) }));
    expect(long?.[0].query).toHaveLength(300);
  });

  it("returns null for invalid JSON or nothing usable", () => {
    expect(parseMapPlaces("not json")).toBeNull();
    expect(parseMapPlaces("42")).toBeNull();
    expect(parseMapPlaces('{"places":[]}')).toBeNull();
  });
});

describe("splitMapBlocks", () => {
  it("returns the text untouched when there is no map fence", () => {
    expect(splitMapBlocks("hello\n\nworld")).toEqual([
      { kind: "text", text: "hello\n\nworld" },
    ]);
  });

  it("splits text around a valid map block", () => {
    const text = `Try this:\n\n${fence('{"query":"Cafe"}')}\n\nEnjoy`;
    expect(splitMapBlocks(text)).toEqual([
      { kind: "text", text: "Try this:\n" },
      { kind: "map", places: [{ query: "Cafe" }] },
      { kind: "text", text: "\nEnjoy" },
    ]);
  });

  it("supports several map blocks in one message", () => {
    const text = `${fence('{"query":"A"}')}\nmid\n${fence('{"query":"B"}')}`;
    const kinds = splitMapBlocks(text).map((s) => s.kind);
    expect(kinds).toEqual(["map", "text", "map"]);
  });

  it("keeps an unclosed (still streaming) fence as text", () => {
    const text = 'before\n```map\n{"query":"Caf';
    expect(splitMapBlocks(text)).toEqual([{ kind: "text", text }]);
  });

  it("keeps invalid JSON blocks as text", () => {
    const text = fence("{oops}");
    expect(splitMapBlocks(text)).toEqual([{ kind: "text", text }]);
  });

  it("does not treat a map fence nested in another code fence as a map", () => {
    const text = "````md\n```map\n{\"query\":\"A\"}\n```\n````";
    const segments = splitMapBlocks(text);
    expect(segments.every((s) => s.kind === "text")).toBe(true);
    expect(segments.map((s) => (s.kind === "text" ? s.text : "")).join("\n")).toBe(
      text,
    );
  });
});

describe("url builders", () => {
  it("encodes the query and key in the embed url", () => {
    const url = new URL(buildEmbedUrl("A & B, 1/2 St", "k&y"));
    expect(url.origin + url.pathname).toBe(
      "https://www.google.com/maps/embed/v1/place",
    );
    expect(url.searchParams.get("q")).toBe("A & B, 1/2 St");
    expect(url.searchParams.get("key")).toBe("k&y");
  });

  it("builds a maps search link", () => {
    const url = new URL(buildMapsLink("Cafe #1"));
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("Cafe #1");
  });
});
