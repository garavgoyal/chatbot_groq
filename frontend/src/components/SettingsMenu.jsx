import { useEffect, useRef } from "react";

const NewChatIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const TrashIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);

const PinIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const LogoutIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

/**
 * The header's settings button opens this. It's one component rendered two
 * ways by CSS: a dropdown anchored under the button on tablet/desktop, and a
 * full-width bottom sheet on phones (where a small anchored dropdown is both
 * hard to hit and easy to lose behind the keyboard).
 *
 * onDeleteChat is only actionable once there's a saved conversation to
 * delete, hence canDelete.
 */
function SettingsMenu({
  isOpen,
  onClose,
  email,
  canDelete,
  locationOn,
  locationAvailable,
  onToggleLocation,
  onNewChat,
  onDeleteChat,
  onLogout,
}) {
  const menuRef = useRef(null);

  // Escape closes it, and focus moves into the menu so keyboard and screen
  // reader users aren't left behind on the (now covered) page.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    menuRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Wrap each action so the menu always closes, without every caller in
  // ChatPage having to remember to close it.
  const run = (action) => () => {
    onClose();
    action();
  };

  return (
    <>
      <div className="settings-backdrop" onClick={onClose} />

      <div className="settings-menu" role="menu" ref={menuRef} tabIndex={-1}>
        <div className="settings-user">
          <span className="settings-user-label">Signed in as</span>
          <span className="settings-user-email">{email || "…"}</span>
        </div>

        {/* Stays open on toggle — flipping a switch shouldn't dismiss the menu
            before you can see whether it took. */}
        <button
          className="settings-item"
          role="menuitemcheckbox"
          aria-checked={locationOn}
          onClick={onToggleLocation}
          disabled={!locationAvailable}
          title={
            locationAvailable
              ? "Use your exact location for weather questions"
              : "Needs HTTPS or localhost — your timezone is used instead"
          }
        >
          {PinIcon}
          <span className="settings-item-text">
            Use my location
            <small>{locationAvailable ? "For weather near you" : "Unavailable over plain http"}</small>
          </span>
          <span className={`settings-switch ${locationOn ? "on" : ""}`} aria-hidden="true" />
        </button>

        <div className="settings-divider" />

        <button className="settings-item" role="menuitem" onClick={run(onNewChat)}>
          {NewChatIcon}
          New chat
        </button>

        <button
          className="settings-item"
          role="menuitem"
          onClick={run(onDeleteChat)}
          disabled={!canDelete}
        >
          {TrashIcon}
          Delete this chat
        </button>

        <div className="settings-divider" />

        <button className="settings-item danger" role="menuitem" onClick={run(onLogout)}>
          {LogoutIcon}
          Log out
        </button>
      </div>
    </>
  );
}

export default SettingsMenu;
