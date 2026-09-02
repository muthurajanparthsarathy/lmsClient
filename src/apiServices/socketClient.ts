import { io, Socket } from "socket.io-client";

// ─── Shared singleton Socket.IO client ──────────────────────────────────────
// The app had no socket client before this. Everything real-time (live
// dashboard, student emissions, future features) MUST reuse this one
// connection — never call io() anywhere else.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5533";

let socket: Socket | null = null;

function readToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("smartcliff_token") || localStorage.getItem("token") || "";
}

/** Get (lazily creating) the single shared socket connection. */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(API_URL, {
    auth: { token: readToken() },
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Keep the auth token fresh on every (re)connect so reconnects stay authed.
  socket.on("reconnect_attempt", () => {
    if (socket) socket.auth = { token: readToken() };
  });

  return socket;
}

/** Optional explicit teardown (e.g. on logout). Components should NOT call this. */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
