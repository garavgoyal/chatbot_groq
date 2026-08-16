// Everything to do with actually sending a message — text, image, or
// document — plus the summarization call used to trim old context.
import { apiFetch, apiFetchJson } from "./client";
import { currentLocation } from "../location";

/**
 * Starts a streamed chat reply. Returns the raw Response so the caller can
 * read the token stream itself and update UI as tokens arrive — that part
 * is presentation logic, not really an "API call", so it stays in the page.
 */
export async function sendChatMessage(conversationId, messages, summary) {
  const res = await apiFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // location lets weather questions about "here" resolve to where the user
    // actually is, instead of a city the model picks for itself.
    body: JSON.stringify({
      conversation_id: conversationId,
      messages,
      summary,
      location: currentLocation(),
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "The chat service is unavailable right now");
  }
  return res;
}

export async function summarize(messages, previousSummary) {
  const data = await apiFetchJson(
    "/api/summarize",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, previous_summary: previousSummary }),
    },
    "Couldn't summarize the conversation",
  );
  return data.summary;
}

/** Returns { reply, tokens } — tokens is Groq's total_tokens for this exchange. */
export async function sendVisionMessage(file, question, conversationId) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("question", question);
  formData.append("conversation_id", conversationId);

  return apiFetchJson("/api/chat/vision", { method: "POST", body: formData }, "Couldn't process that image");
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetchJson("/api/upload/document", { method: "POST", body: formData }, "Couldn't index that document");
}
