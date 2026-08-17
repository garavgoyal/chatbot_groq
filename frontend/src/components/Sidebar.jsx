/**
 * Slide-over drawer, toggled by the hamburger button in the header.
 * isOpen controls the CSS transform; a backdrop behind it closes it on click.
 */
function Sidebar({ conversations, activeId, isOpen, onClose, onSelect, onNewChat }) {
  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <button
          className="new-chat-button"
          onClick={() => {
            onNewChat();
            onClose();
          }}
        >
          + New chat
        </button>

        <p className="sidebar-eyebrow">Conversations</p>

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