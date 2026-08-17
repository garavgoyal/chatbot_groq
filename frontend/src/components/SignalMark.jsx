/** The three-bar signal mark used as the brand mark, echoing the favicon. */
function SignalMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--signal)" />
      <rect x="8" y="17" width="3.4" height="8" rx="1" fill="var(--signal-ink)" />
      <rect x="14.3" y="10" width="3.4" height="15" rx="1" fill="var(--signal-ink)" />
      <rect x="20.6" y="14" width="3.4" height="11" rx="1" fill="var(--signal-ink)" />
    </svg>
  );
}

export default SignalMark;
