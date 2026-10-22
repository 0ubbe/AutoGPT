import { buildEmbedUrl, buildMapsLink, type MapPlace } from "./helpers";

interface Props {
  places: MapPlace[];
  /** Override for tests; defaults to the build-time public env var. */
  apiKey?: string;
}

function label(place: MapPlace): string {
  return place.name ?? place.query;
}

/**
 * Google Maps Embed for the first place, plain links for the rest.
 *
 * The Embed API shows one pin per map, so extra places are listed as links
 * instead of stacking several iframes. Without an API key (or if the embed is
 * not wanted) every place degrades to an "Open in Google Maps" link.
 */
export function MapEmbedCard({ places, apiKey }: Props) {
  if (places.length === 0) return null;

  const key = apiKey ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
  const [primary, ...rest] = places;

  return (
    <div
      className="my-3 overflow-hidden rounded-xl border border-zinc-200 bg-white"
      data-testid="map-embed-card"
    >
      {key ? (
        <iframe
          title={`Map of ${label(primary)}`}
          src={buildEmbedUrl(primary.query, key)}
          className="h-64 w-full border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      ) : null}
      <div className="flex flex-col gap-1 px-3 py-2 text-sm">
        <a
          href={buildMapsLink(primary.query)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-500 hover:underline"
        >
          {key ? label(primary) : `Open ${label(primary)} in Google Maps`}
        </a>
        {rest.length > 0 ? (
          <ul
            className="flex list-disc flex-col gap-0.5 pl-5 text-zinc-700"
            aria-label="More places"
          >
            {rest.map((place) => (
              <li key={place.query}>
                <a
                  href={buildMapsLink(place.query)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {label(place)}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
