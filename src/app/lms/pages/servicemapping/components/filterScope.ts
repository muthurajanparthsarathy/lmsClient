import type { MappingFacets } from "../api/serviceMappingService";

/* Narrowing the filter dropdowns to a client selection.
 *
 * Business model is a client attribute, but service models and years live on
 * the mappings — which the browser only ever holds a page of. So the answer
 * comes from the server's `byClient` facet (one entry per client, listing what
 * that client actually has) and the intersection is done here, locally, so a
 * checkbox toggle re-narrows the other dropdowns with no round-trip. */

export interface ClientScope {
  businessModels: string[];
  serviceModels: string[];
  years: string[];
  services: string[];
  courses: string[];
}

/** What is actually on offer for `clients`.
 *
 *  Returns null to mean "do not narrow" in the two cases where narrowing is
 *  either impossible or wrong: no clients picked (an empty filter means "no
 *  filter" everywhere else on this page, so every option stays available), and
 *  a backend that predates the `byClient` facet — where falling back to the
 *  full institution lists is the old behaviour rather than a broken one.
 *
 *  A selection whose clients have no mappings yields empty lists, not null:
 *  there genuinely is nothing to offer, and showing the whole institution
 *  there would be a lie. */
export function scopeByClients(
  facets: MappingFacets | undefined,
  clients: string[]
): ClientScope | null {
  const byClient = facets?.byClient;
  if (!byClient || !clients.length) return null;

  const picked = new Set(clients);
  const rows = byClient.filter((row) => picked.has(row.client));

  const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
  return {
    businessModels: uniq(rows.map((row) => row.businessModel)),
    serviceModels: uniq(rows.flatMap((row) => row.serviceModels)),
    years: uniq(rows.flatMap((row) => row.years)),
    // Optional on the wire: a backend predating these keeps the older shape,
    // and an empty list here just means "do not narrow that dropdown".
    services: uniq(rows.flatMap((row) => row.services || [])),
    courses: uniq(rows.flatMap((row) => row.courses || [])),
  };
}

/** Drop selections that the current client scope no longer offers.
 *
 *  Without this a filter stays active while its option is gone from the list —
 *  an invisible predicate that silently empties the table and gives the reader
 *  nothing to un-tick. Identity is preserved when nothing needs dropping, so
 *  this is safe to feed straight back into setState without looping. */
export function pruneToScope(value: string[], allowed: string[] | undefined): string[] {
  if (!allowed) return value;
  const offered = new Set(allowed);
  const kept = value.filter((item) => offered.has(item));
  return kept.length === value.length ? value : kept;
}

/** Every option ticked means the same thing as no filter at all — but sent
 *  literally it would put every id in the query string, hundreds of them, past
 *  the 1000-id guard the server rejects on. The dropdown still SHOWS them all
 *  ticked; only the request collapses. */
export function collapseAll(value: string[], optionCount: number): string[] {
  return optionCount > 0 && value.length >= optionCount ? [] : value;
}
