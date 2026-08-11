import { useState } from "react";
import UploadButton from "./UploadButton";
import AttachmentPreview from "./AttachmentPreview";
import { useSpeechRecognition } from "./useSpeechRecognition";

const PaperclipIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const DocIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const SendIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
  </svg>
);

const MicIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
    <path d="M19 10v2a7 7 0 01-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

function ChatInput({ onSend, onAttachDoc, onAttachImage, attachment, onRemoveAttachment, loading }) {
  const [input, setInput] = useState("");
  const { isListening, startListening } = useSpeechRecognition();

  const canSend = (input.trim() || attachment) && !loading;

  const handleSend = () => {
    if (!canSend) return;
    onSend(input);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicClick = () => {
    startListening((transcript) => {
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    });
  };

  return (
    <div className="chat-input-area">
      <AttachmentPreview attachment={attachment} onRemove={onRemoveAttachment} />

      <div className="chat-input">
        <UploadButton
          icon={PaperclipIcon}
          label="Attach image"
          accept="image/*"
          disabled={loading}
          onFileSelected={onAttachImage}
        />
        <UploadButton
          icon={DocIcon}
          label="Attach document (PDF/TXT)"
          accept=".pdf,.txt"
          disabled={loading}
          onFileSelected={onAttachDoc}
        />

        <button
          className={`icon-button ${isListening ? "mic-active" : ""}`}
          onClick={handleMicClick}
          disabled={loading}
          title={isListening ? "Listening..." : "Speak your message"}
          type="button"
        >
          {MicIcon}
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={attachment ? "Add a message about this file (optional)..." : "Message AI Assistant"}
          rows={1}
          disabled={loading}
        />

        <button className="send-button" onClick={handleSend} disabled={!canSend}>
          {SendIcon}
        </button>
      </div>

      <p className="disclaimer">AI can make mistakes. Verify important information.</p>
    </div>
  );
}

export default ChatInput;