import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

/**
 * onQuickAction: called with pill text when the user taps a suggestion
 * under the latest assistant reply. loading: hides pills while a reply
 * is still streaming in, so they can't be tapped mid-response.
 */
function ChatWindow({ messages, onQuickAction, loading }) {
  const containerRef = useRef(null);

  // Scroll this container directly rather than calling scrollIntoView on a
  // sentinel: scrollIntoView also scrolls every scrollable ancestor, which on
  // mobile fights the browser as it repositions the page around the keyboard.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const lastAssistantIndex = [...messages]
    .map((m, i) => ({ ...m, i }))
    .reverse()
    .find((m) => m.role === "assistant")?.i;

  return (
    <div className="chat-messages" ref={containerRef}>
      {messages.length === 0 && (
        <p className="empty-state">Say something, or upload a doc/image to get started.</p>
      )}
      {messages.map((m, i) => (
        <MessageBubble
          key={i}
          message={m}
          showQuickActions={i === lastAssistantIndex && !loading && m.content}
          onQuickAction={onQuickAction}
        />
      ))}
    </div>
  );
}

export default ChatWindow;