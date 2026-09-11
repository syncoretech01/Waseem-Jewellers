/**
 * The microphone, as a hairline.
 *
 * It lived inside `CollectionExperience` and was imported from there by three concierge
 * surfaces — one of them the homepage hero's invitation — so a seven-line glyph carried a
 * page-sized module into every first load.
 */
export function MicGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
    </svg>
  );
}
