// @vitest-environment-options { "settings": { "disableIframePageLoading": true } }
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MapEmbedCard } from "../MapEmbedCard";

afterEach(cleanup);

describe("MapEmbedCard", () => {
  it("embeds the first place and links the rest", () => {
    render(
      <MapEmbedCard
        apiKey="test-key"
        places={[
          { name: "Cafe One", query: "Cafe One, Main St" },
          { name: "Cafe Two", query: "Cafe Two, Oak St" },
        ]}
      />,
    );
    const frame = screen.getByTitle("Map of Cafe One");
    expect(frame.tagName).toBe("IFRAME");
    const src = new URL(frame.getAttribute("src") ?? "");
    expect(src.searchParams.get("q")).toBe("Cafe One, Main St");
    expect(src.searchParams.get("key")).toBe("test-key");
    expect(document.querySelectorAll("iframe")).toHaveLength(1);

    const more = screen.getByRole("link", { name: "Cafe Two" });
    expect(more.getAttribute("href")).toContain("google.com/maps/search");
    expect(more.getAttribute("rel")).toContain("noopener");
  });

  it("falls back to a link when no API key is configured", () => {
    render(<MapEmbedCard apiKey="" places={[{ query: "Eiffel Tower" }]} />);
    expect(document.querySelector("iframe")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Open Eiffel Tower in Google Maps" }),
    ).toBeTruthy();
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(<MapEmbedCard apiKey="k" places={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
