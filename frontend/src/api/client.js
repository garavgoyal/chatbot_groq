// Low-level fetch wrapper. Nothing in here knows about any specific
// endpoint — that's what auth.js / conversations.js / chat.js are for.
// Two things live here on purpose:
//  - API_BASE, so it's configured once (via VITE_API_BASE) instead of
//    hardcoded in every file that talks to the backend.
//  - apiFetch, so the "attach the auth token / bail out on 401" logic
//    exists in one spot instead of being copy-pasted at every call site.

// `??` rather than `||` on purpose: an explicitly *empty* VITE_API_BASE means
// "call /api on my own origin and let the Vite proxy forward it" (see
// vite.config.js), which is what makes the app work when opened from a phone
// on the LAN. Only an entirely missing value falls back to localhost.
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export class UnauthorizedError extends Error {
  constructor() {
    super("Session expired");
    this.name = "UnauthorizedError";
  }
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * fetch() wrapped with auth headers and 401 handling.
 * Throws UnauthorizedError on a 401 so callers can catch it once,
 * at whatever level makes sense, instead of checking res.status
 * after every single request.
 */
export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: authHeaders(options.headers),
  });
  if (res.status === 401) throw new UnauthorizedError();
  return res;
}

/** Same as apiFetch, but parses the JSON body and throws with the
 * backend's error detail on a non-2xx response — most callers want
 * exactly this instead of checking res.ok themselves every time. */
export async function apiFetchJson(path, options = {}, fallbackErrorMessage = "Request failed") {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || fallbackErrorMessage);
  return data;
}
