import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { speak, stopSpeaking } from "./speak";

const SpeakerIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.5 8.5a5 5 0 010 7" />
  </svg>
);

const StopIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </svg>
);

function isDisplayableImage(url) {
  return typeof url === "string" && /^(blob:|https?:|data:)/.test(url);
}

const RATES = [0.75, 1, 1.25, 1.5, 2];

function MessageBubble({ message, showQuickActions, isStreaming, onQuickAction }) {
  const { role, content, imageUrl } = message;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rateIndex, setRateIndex] = useState(1);

  const handleSpeakClick = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      speak(content, RATES[rateIndex], () => setIsSpeaking(false));
      setIsSpeaking(true);
    }
  };

  const handleRateClick = (e) => {
    e.stopPropagation();
    const nextIndex = (rateIndex + 1) % RATES.length;
    setRateIndex(nextIndex);
    if (isSpeaking) {
      speak(content, RATES[nextIndex], () => setIsSpeaking(false));
    }
  };

  if (role === "system") {
    return <div className="system-note">{content}</div>;
  }

  if (isStreaming) {
    return (
      <div className="thinking" aria-label="Assistant is responding">
        <span />
        <span />
        <span />
        <span />
      </div>
    );
  }

  return (
    <div>
      <div className={`message-row ${role}`}>
        <div className={`message ${role}`}>
          {isDisplayableImage(imageUrl) && (
            <img src={imageUrl} alt="uploaded" className="message-image" />
          )}
          {content && role === "assistant" && (
            <div className="markdown-content">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
          {content && role === "user" && <p>{content}</p>}

          {content && role === "assistant" && (
            <div className="speak-controls">
              <button className="speak-button" onClick={handleSpeakClick} title={isSpeaking ? "Stop" : "Read aloud"} type="button">
                {isSpeaking ? StopIcon : SpeakerIcon}
              </button>
              <button className="rate-button" onClick={handleRateClick} title="Change speed" type="button">
                {RATES[rateIndex]}x
              </button>
            </div>
          )}
        </div>
      </div>

      {showQuickActions && (
        <div className="quick-actions">
          <button className="quick-action-pill" onClick={() => onQuickAction("Explain more")}>Explain more</button>
          <button className="quick-action-pill" onClick={() => onQuickAction("Give an example")}>Give an example</button>
        </div>
      )}
    </div>
  );
}

export default MessageBubble;