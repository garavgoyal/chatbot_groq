// Auth calls to our own backend (email/password). These happen before a
// token exists, so they use plain fetch + API_BASE rather than apiFetch
// (which assumes you already have a token to attach).
import { API_BASE, apiFetchJson } from "./client";

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "Request failed");
  return data;
}

export function login(email, password) {
  return postJson("/api/auth/login", { email, password });
}

export function signup(email, password) {
  return postJson("/api/auth/signup", { email, password });
}

/** Who the current token belongs to — { user_id, email }. Unlike the two
 * above, this one needs the token attached, hence apiFetchJson. */
export function getMe() {
  return apiFetchJson("/api/auth/me", {}, "Couldn't load your account");
}
