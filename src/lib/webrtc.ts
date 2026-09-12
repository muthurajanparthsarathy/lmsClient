// ─── Shared WebRTC ICE server configuration ─────────────────────────────────
// Used by BOTH the student broadcaster (useLiveScreenShare) and the proctor
// viewer (useProctorScreens) so their ICE configs can never drift apart.
//
// TURN relay = Metered (https://dashboard.metered.ca). This is REQUIRED so live
// screens connect across the internet (different networks / NAT / firewalls),
// not just on a shared LAN. Without a working TURN relay the proctor only ever
// sees a black "waiting for screen".
//
// The :443 and TLS/TCP variants share the same credentials and punch through
// firewalls that block UDP / port 80.
//
// NOTE: these credentials are visible in the client bundle — unavoidable for a
// browser WebRTC app, and fine for a Metered free/standard plan. Rotate them in
// the Metered dashboard whenever you like (just update the 2 constants below).
// For unlimited scale / tighter security later, self-host coturn — see
// COTURN_SETUP.md at the repo root.

const METERED_USERNAME = "b2eb2b93df5b07c5e402a1d1";
const METERED_CREDENTIAL = "Rm2Np/yMfePLRnEn";

const ICE_SERVERS: RTCIceServer[] = [
  // STUN — direct / NAT-reflexive paths, tried first when reachable.
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.relay.metered.ca:80" },

  // TURN relay — Metered (all transports for best firewall traversal).
  { urls: "turn:global.relay.metered.ca:80", username: METERED_USERNAME, credential: METERED_CREDENTIAL },
  { urls: "turn:global.relay.metered.ca:80?transport=tcp", username: METERED_USERNAME, credential: METERED_CREDENTIAL },
  { urls: "turn:global.relay.metered.ca:443", username: METERED_USERNAME, credential: METERED_CREDENTIAL },
  { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: METERED_USERNAME, credential: METERED_CREDENTIAL },
];

/** ICE servers for every live-screens RTCPeerConnection (STUN + Metered TURN). */
export function getIceServers(): RTCIceServer[] {
  return ICE_SERVERS;
}
