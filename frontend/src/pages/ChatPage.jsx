import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";
import Sidebar from "../components/Sidebar";
import SettingsMenu from "../components/SettingsMenu";
import { UnauthorizedError } from "../api/client";
import { getMe } from "../api/auth";
import { supabase, supabaseConfigured } from "../supabaseClient";
import {
  geolocationAvailable,
  locationConsentGiven,
  enableLocation,
  disableLocation,
} from "../location";
import {
  listConversations,
  createConversation,
  getConversationMessages,
  deleteConversation,
} from "../api/conversations";
import { sendChatMessage, summarize as summarizeApi, sendVisionMessage, uploadDocument } from "../api/chat";

const MAX_BEFORE_SUMMARY = 8;
const RECENT_KEEP = 4;
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // keep in sync with backend MAX_DOCUMENT_SIZE
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;     // keep in sync with backend MAX_IMAGE_SIZE

// Matches the out-of-band marker the backend appends after a streamed reply
// (see TOKEN_USAGE_MARKER in main.py) — pulled out before the text is shown.
const TOKEN_USAGE_REGEX = /\n\n<<<TOKEN_USAGE:(\d+)>>>$/;

const MenuIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const SettingsIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [locationOn, setLocationOn] = useState(locationConsentGiven);
  const navigate = useNavigate();

  // On first load: fetch the sidebar list, and reopen whatever
  // conversation the user was last in (remembered via localStorage).
  useEffect(() => {
    fetchConversations().catch(handleIfUnauthorized);
    const savedId = localStorage.getItem("active_conversation_id");
    if (savedId) loadConversation(savedId).catch(handleIfUnauthorized);

    // Fetched once here rather than when the settings menu opens, so the
    // menu has the address ready the moment it appears.
    getMe()
      .then((me) => setUserEmail(me.email))
      .catch(() => {}); // cosmetic — an empty email shouldn't break the chat
  }, []);

  // If a request comes back 401 (expired/invalid token), bounce to login
  // instead of leaving the UI in a broken half-loaded state. Centralized
  // here so every caller can just `.catch(handleIfUnauthorized)` or let
  // it bubble up to handleSend's try/catch below.
  const handleIfUnauthorized = (err) => {
    if (!(err instanceof UnauthorizedError)) throw err;
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  };

  const handleLogout = async () => {
    // Google sign-ins also hold a Supabase session in this browser; without
    // signing that out too, hitting "Sign in with Google" would silently drop
    // the previous account straight back in.
    if (supabaseConfigured) {
      await supabase.auth.signOut().catch(() => {});
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("active_conversation_id");
    navigate("/login");
  };

  // Turning it on triggers the browser's permission prompt; if the user
  // declines (or the fix times out) we say so rather than leaving a switch
  // flipped on that isn't actually giving us anything.
  const handleToggleLocation = async () => {
    if (locationOn) {
      disableLocation();
      setLocationOn(false);
      return;
    }

    const granted = await enableLocation();
    setLocationOn(granted);
    if (!granted) {
      setSettingsOpen(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content:
            "⚠️ Couldn't get your location. Weather questions will fall back to your timezone, which is less precise.",
        },
      ]);
    }
  };

  const handleDeleteChat = async () => {
    if (!conversationId) return;
    if (!window.confirm("Delete this conversation? This can't be undone.")) return;

    try {
      await deleteConversation(conversationId);
    } catch (err) {
      if (err instanceof UnauthorizedError) return handleIfUnauthorized(err);
      setMessages((prev) => [...prev, { role: "system", content: `⚠️ ${err.message}` }]);
      return;
    }

    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    handleNewChat();
  };

  const fetchConversations = async () => {
    setConversations(await listConversations());
  };

  const loadConversation = async (id) => {
    const data = await getConversationMessages(id);
    if (!data) return;

    // DB rows use snake_case (image_url); our components expect imageUrl
    const normalized = data.map((m) => ({
      role: m.role,
      content: m.content,
      imageUrl: m.image_url || undefined,
    }));

    setMessages(normalized);
    setSummary(""); // older context isn't persisted yet — trimming will rebuild it as the chat grows again
    setConversationId(id);
    setAttachment(null);
    localStorage.setItem("active_conversation_id", id);
  };

  const handleSelectConversation = (id) => {
    if (id !== conversationId) loadConversation(id);
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setSummary("");
    setAttachment(null);
    localStorage.removeItem("active_conversation_id");
  };

  // Creates a conversation row in the DB the first time this chat
  // actually needs one (i.e. right before the first message is sent).
  const ensureConversation = async () => {
    if (conversationId) return conversationId;

    const data = await createConversation("New Chat");

    setConversationId(data.id);
    localStorage.setItem("active_conversation_id", data.id);
    setConversations((prev) => [data, ...prev]);
    return data.id;
  };

  // Reject oversized files before spending a round-trip on them —
  // limits kept in sync with the backend's own MAX_DOCUMENT_SIZE/MAX_IMAGE_SIZE.
  const tooLarge = (file, max) => {
    if (file.size <= max) return false;
    setMessages((prev) => [
      ...prev,
      { role: "system", content: `⚠️ "${file.name}" is too large (max ${Math.round(max / (1024 * 1024))}MB).` },
    ]);
    return true;
  };

  const handleAttachDoc = (file) => {
    if (tooLarge(file, MAX_DOCUMENT_SIZE)) return;
    setAttachment({ type: "doc", file });
  };
  const handleAttachImage = (file) => {
    if (tooLarge(file, MAX_IMAGE_SIZE)) return;
    setAttachment({ type: "image", file, previewUrl: URL.createObjectURL(file) });
  };
  const handleRemoveAttachment = () => setAttachment(null);

  const maybeSummarize = async (allMessages, currentSummary) => {
    if (allMessages.length <= MAX_BEFORE_SUMMARY) {
      return { summary: currentSummary, kept: allMessages };
    }
    const toSummarize = allMessages.slice(0, -RECENT_KEEP);
    const kept = allMessages.slice(-RECENT_KEEP);

    const newSummary = await summarizeApi(toSummarize, currentSummary);
    return { summary: newSummary, kept };
  };

  const sendTextMessage = async (text, convId) => {
    const userMsg = { role: "user", content: text };
    let newMessages = [...messages, userMsg];

    const { summary: newSummary, kept } = await maybeSummarize(newMessages, summary);
    setSummary(newSummary);
    newMessages = kept;

    setMessages([...newMessages, { role: "assistant", content: "" }]);

    const res = await sendChatMessage(convId, newMessages, newSummary);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });

      // Strip the trailing token-usage marker (if it's arrived yet) before
      // displaying — it's metadata, not part of the reply.
      const usageMatch = fullText.match(TOKEN_USAGE_REGEX);
      const displayText = usageMatch ? fullText.slice(0, usageMatch.index) : fullText;

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: displayText,
          tokens: usageMatch ? Number(usageMatch[1]) : undefined,
        };
        return updated;
      });
    }
  };

  const sendImageMessage = async (text, file, previewUrl, convId) => {
    const question = text.trim() || "Describe this image in detail.";

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, imageUrl: previewUrl },
      { role: "assistant", content: "" },
    ]);

    const data = await sendVisionMessage(file, question, convId);

    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = { role: "assistant", content: data.reply, tokens: data.tokens };
      return updated;
    });
  };

  const sendDocMessage = async (text, file, convId) => {
    setMessages((prev) => [...prev, { role: "system", content: `📄 Indexing "${file.name}"...` }]);

    const data = await uploadDocument(file);

    setMessages((prev) => [
      ...prev,
      { role: "system", content: `✅ "${file.name}" indexed (${data.chunks_added} chunks)` },
    ]);

    const question = text.trim() || `Summarize the document "${file.name}".`;
    await sendTextMessage(question, convId);
  };

  const handleSend = async (text) => {
    if (!text.trim() && !attachment) return;
    setLoading(true);

    try {
      const convId = await ensureConversation();

      if (attachment?.type === "image") {
        await sendImageMessage(text, attachment.file, attachment.previewUrl, convId);
      } else if (attachment?.type === "doc") {
        await sendDocMessage(text, attachment.file, convId);
      } else {
        await sendTextMessage(text, convId);
      }

      fetchConversations(); // refresh sidebar so title/ordering reflect the new message
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        handleIfUnauthorized(err);
        return;
      }
      const detail = err instanceof TypeError
        ? "Is the backend running?"
        : err.message || "Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "system", content: `⚠️ Something went wrong. ${detail}` },
      ]);
    } finally {
      setAttachment(null);
      setLoading(false);
    }
  };

  const handleQuickAction = (text) => {
    handleSend(text);
  };

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={conversationId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
      />

      <div className="chat-container">
        <header className="chat-header">
          {/* Hidden by CSS from 1024px up, where the sidebar is always visible. */}
          <button
            className="header-icon-button menu-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            {MenuIcon}
          </button>
          <span className="header-title">AI Assistant</span>
          <button
            className="header-icon-button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label="Settings"
            aria-expanded={settingsOpen}
            aria-haspopup="menu"
          >
            {SettingsIcon}
          </button>

          <SettingsMenu
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            email={userEmail}
            canDelete={Boolean(conversationId)}
            locationOn={locationOn}
            locationAvailable={geolocationAvailable}
            onToggleLocation={handleToggleLocation}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            onLogout={handleLogout}
          />
        </header>

        <ChatWindow messages={messages} onQuickAction={handleQuickAction} loading={loading} />

        <ChatInput
          onSend={handleSend}
          onAttachDoc={handleAttachDoc}
          onAttachImage={handleAttachImage}
          attachment={attachment}
          onRemoveAttachment={handleRemoveAttachment}
          loading={loading}
        />
      </div>
    </div>
  );
}

export default ChatPage;