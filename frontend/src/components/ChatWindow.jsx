import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

/**
 * onQuickAction: called with pill text when the user taps a suggestion
 * under the latest assistant reply. loading: hides pills while a reply
 * is still streaming in, so they can't be tapped mid-response.
 */
function ChatWindow({ messages, onQuickAction, loading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const lastAssistantIndex = [...messages]
    .map((m, i) => ({ ...m, i }))
    .reverse()
    .find((m) => m.role === "assistant")?.i;

  return (
    <div className="chat-messages">
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
      <div ref={bottomRef} />
    </div>
  );
}

export default ChatWindow;