// Everything to do with the conversation list / history — creating,
// listing, and loading the messages for one conversation.
import { apiFetch, apiFetchJson } from "./client";

export function listConversations() {
  return apiFetchJson("/api/conversations", {}, "Couldn't load conversations");
}

export function createConversation(title = "New Chat") {
  return apiFetchJson(
    "/api/conversations",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) },
    "Couldn't create a new conversation",
  );
}

export function deleteConversation(conversationId) {
  return apiFetchJson(
    `/api/conversations/${conversationId}`,
    { method: "DELETE" },
    "Couldn't delete this conversation",
  );
}

export async function getConversationMessages(conversationId) {
  const res = await apiFetch(`/api/conversations/${conversationId}/messages`);
  if (!res.ok) return null; // caller treats a missing/failed load as "nothing to show", not fatal
  return res.json();
}
