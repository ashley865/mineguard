// The MineGuard mark — a shield (protection) with a radiating signal arc (active
// monitoring/security), refined from the "Radar Guard" concept picked from the logo
// exploration canvas. `dark` selects the on-dark-background palette (amber shield+accent,
// for the app's own dark surfaces like Cyber Command Center); the default is the
// on-light palette (navy shield, amber accent) used everywhere else, since the app's
// default theme is light (see index.css: body is bg-mine-950/text-mine-50).
export function LogoMark({ size = 24, dark = false, className = "" }: { size?: number; dark?: boolean; className?: string }) {
  const shield = dark ? "#d9a441" : "#0b1220";
  const accent = dark ? "#d9a441" : "#c48a1f";
  // Below ~28px the second, fainter arc disappears into a blur — drop it rather than
  // let it muddy the mark at favicon/sidebar sizes.
  const showOuterArc = size >= 28;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <path d="M50 6 L88 20 V46 C88 72 70 90 50 96 C30 90 12 72 12 46 V20 Z" stroke={shield} strokeWidth="7" fill="none" />
      <circle cx="50" cy="68" r="6" fill={accent} />
      <path d="M36 68 A14 14 0 0 1 64 68" stroke={accent} strokeWidth="7" fill="none" strokeLinecap="round" />
      {showOuterArc && <path d="M25 68 A25 25 0 0 1 75 68" stroke={accent} strokeWidth="5" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

// The wordmark's "Guard" half is always the amber accent — use this instead of typing
// "Mine<span>Guard</span>" by hand so every occurrence stays in sync.
export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <>
      Mine
      <span className={dark ? "text-hazard-400" : "text-hazard-500"}>Guard</span>
    </>
  );
}
