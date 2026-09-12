// The API origin, in one place.
//
// This module deliberately has NO imports. Every service file needs the origin,
// and several of them are imported by `http.ts` itself — pulling it from there
// would create import cycles. Keep it dependency-free.
//
// Why it exists: the origin used to be written out as a literal
// "https://lmsserver-yeve.onrender.com" in 150+ places. Those literals are baked into the
// client bundle at build time, so on any host that is not the developer's own
// machine they point the browser at ITSELF rather than at the API. Anything
// deployed anywhere needs a single build-time value instead.
//
// Set NEXT_PUBLIC_API_URL at build time (it must be present when `next build`
// runs — NEXT_PUBLIC_* values are inlined, not read at runtime). The localhost
// fallback keeps `npm run dev` working with no .env at all, exactly as before.

const RAW_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "https://lmsserver-yeve.onrender.com";

/** API origin with no trailing slash, e.g. "https://api.example.com". */
export const API_ORIGIN: string = RAW_ORIGIN.replace(/\/+$/, "");

/** Same host over WebSocket: https -> wss, http -> ws. */
export const WS_ORIGIN: string = API_ORIGIN.replace(/^http/, "ws");
