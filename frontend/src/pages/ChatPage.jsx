import { useState, useEffect } from "react";
import ChatWindow from "../components/ChatWindow";
import ChatInput from "../components/ChatInput";
import Sidebar from "../components/Sidebar";

const API_BASE = "http://localhost:8000";
const MAX_BEFORE_SUMMARY = 8;
const RECENT_KEEP = 4;

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

  // On first load: fetch the sidebar list, and reopen whatever
  // conversation the user was last in (remembered via localStorage).
  useEffect(() => {
    fetchConversations();
    const savedId = localStorage.getItem("active_conversation_id");
    if (savedId) loadConversation(savedId);
  }, []);

  const fetchConversations = async () => {
    const res = await fetch(`${API_BASE}/api/conversations`);
    if (res.ok) setConversations(await res.json());
  };

  const loadConversation = async (id) => {
    const res = await fetch(`${API_BASE}/api/conversations/${id}/messages`);
    if (!res.ok) return;
    const data = await res.json();

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

    const res = await fetch(`${API_BASE}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat" }),
    });
    const data = await res.json();

    setConversationId(data.id);
    localStorage.setItem("active_conversation_id", data.id);
    setConversations((prev) => [data, ...prev]);
    return data.id;
  };

  const handleAttachDoc = (file) => setAttachment({ type: "doc", file });
  const handleAttachImage = (file) =>
    setAttachment({ type: "image", file, previewUrl: URL.createObjectURL(file) });
  const handleRemoveAttachment = () => setAttachment(null);

  const maybeSummarize = async (allMessages, currentSummary) => {
    if (allMessages.length <= MAX_BEFORE_SUMMARY) {
      return { summary: currentSummary, kept: allMessages };
    }
    const toSummarize = allMessages.slice(0, -RECENT_KEEP);
    const kept = allMessages.slice(-RECENT_KEEP);

    const res = await fetch(`${API_BASE}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: toSummarize, previous_summary: currentSummary }),
    });
    const data = await res.json();
    return { summary: data.summary, kept };
  };

  const sendTextMessage = async (text, convId) => {
    const userMsg = { role: "user", content: text };
    let newMessages = [...messages, userMsg];

    const { summary: newSummary, kept } = await maybeSummarize(newMessages, summary);
    setSummary(newSummary);
    newMessages = kept;

    setMessages([...newMessages, { role: "assistant", content: "" }]);

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: convId, messages: newMessages, summary: newSummary }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: fullText };
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

    const formData = new FormData();
    formData.append("file", file);
    formData.append("question", question);
    formData.append("conversation_id", convId);

    const res = await fetch(`${API_BASE}/api/chat/vision`, { method: "POST", body: formData });
    const data = await res.json();

    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = { role: "assistant", content: data.reply };
      return updated;
    });
  };

  const sendDocMessage = async (text, file, convId) => {
    setMessages((prev) => [...prev, { role: "system", content: `📄 Indexing "${file.name}"...` }]);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/api/upload/document`, { method: "POST", body: formData });
    const data = await res.json();

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
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: "⚠️ Something went wrong. Is the backend running?" },
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
          <button className="header-icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            {MenuIcon}
          </button>
          <span className="header-title">AI Assistant</span>
          <button className="header-icon-button" aria-label="Settings">
            {SettingsIcon}
          </button>
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