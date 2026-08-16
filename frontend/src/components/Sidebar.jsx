const CloseIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

/**
 * Conversation list. On phones and tablets it's a slide-over drawer toggled
 * by the hamburger in the header (isOpen drives the CSS transform, and a
 * backdrop behind it closes it on tap); from 1024px up the CSS drops the
 * transform and it just sits in the layout as a permanent column, which is
 * why onClose is safe to call unconditionally below.
 */
function Sidebar({ conversations, activeId, isOpen, onClose, onSelect, onNewChat }) {
  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <p className="sidebar-heading">Chats</p>
          <button className="sidebar-close" onClick={onClose} aria-label="Close menu" type="button">
            {CloseIcon}
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={() => {
            onNewChat();
            onClose();
          }}
        >
          + New chat
        </button>

        <div className="conversation-list">
          {conversations.length === 0 && <p className="sidebar-empty">No conversations yet</p>}
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`conversation-item ${c.id === activeId ? "active" : ""}`}
              onClick={() => {
                onSelect(c.id);
                onClose();
              }}
              title={c.title}
            >
              {c.title || "New Chat"}
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
