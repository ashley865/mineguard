// Small stroke-based icon set (24px grid, currentColor) shared by the executive
// dashboard's icon-badge stat cards (CFO/COO/HR widgets) — one place instead of
// duplicating SVG markup per widget.

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export function TrendingUpIcon() {
  return (
    <Icon>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </Icon>
  );
}

export function TrendingDownIcon() {
  return (
    <Icon>
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </Icon>
  );
}

export function CoinsIcon() {
  return (
    <Icon>
      <circle cx="8" cy="8" r="6" />
      <circle cx="15" cy="15" r="6" />
      <path d="M8 5v6M5 8h6" />
    </Icon>
  );
}

export function PackageIcon() {
  return (
    <Icon>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </Icon>
  );
}

export function WalletIcon() {
  return (
    <Icon>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </Icon>
  );
}

export function ReceiptIcon() {
  return (
    <Icon>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </Icon>
  );
}

export function GaugeIcon() {
  return (
    <Icon>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M12 3a9 9 0 0 0-9 9M19.07 6.93 15.5 10.5M4.5 20h15M2 15a10 10 0 0 1 20 0" />
    </Icon>
  );
}

export function LayersIcon() {
  return (
    <Icon>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </Icon>
  );
}

export function GemIcon() {
  return (
    <Icon>
      <path d="M6 3h12l4 6-10 12L2 9Z" />
      <path d="M2 9h20" />
    </Icon>
  );
}

export function RefreshIcon() {
  return (
    <Icon>
      <path d="M21 2v6h-6M3 22v-6h6" />
      <path d="M21 8a9 9 0 0 0-15-6.7L3 8M3 16a9 9 0 0 0 15 6.7L21 16" />
    </Icon>
  );
}

export function ZapIcon() {
  return (
    <Icon>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </Icon>
  );
}

export function ListIcon() {
  return (
    <Icon>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </Icon>
  );
}

export function AlertTriangleIcon() {
  return (
    <Icon>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </Icon>
  );
}

export function ClockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Icon>
  );
}

export function ShieldCheckIcon() {
  return (
    <Icon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function ShieldOffIcon() {
  return (
    <Icon>
      <path d="M19.7 14a6.9 6.9 0 0 0 .3-2V5l-8-3-3.2 1.2M4.7 4.7 4 5v7c0 6 8 10 8 10a20.3 20.3 0 0 0 5.6-4.2M2 2l20 20" />
    </Icon>
  );
}

export function GraduationCapIcon() {
  return (
    <Icon>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
    </Icon>
  );
}

export function HeartPulseIcon() {
  return (
    <Icon>
      <path d="M19 14c1.5-1.5 3-3.4 3-5.5A4.5 4.5 0 0 0 17.5 4c-1.7 0-3 .8-3.5 2-.5-1.2-1.8-2-3.5-2A4.5 4.5 0 0 0 6 8.5C6 12 9 15 12 18c.6-.6 1.3-1.2 2-1.9" />
      <path d="M2 12h4l2-4 3 8 2-4h9" />
    </Icon>
  );
}

export function PalmtreeIcon() {
  return (
    <Icon>
      <path d="M12 22v-9" />
      <path d="M12 13c-3-1-6-3-6-6 3 0 5 1 6 3 1-2 3-3 6-3 0 3-3 5-6 6Z" />
      <path d="M12 10c-1-2-3-4-6-4 1 3 3 4 6 4Zm0 0c1-2 3-4 6-4-1 3-3 4-6 4Z" />
    </Icon>
  );
}

export function PhoneIcon() {
  return (
    <Icon>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2Z" />
    </Icon>
  );
}

export function IdCardIcon() {
  return (
    <Icon>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="8" cy="11" r="2" />
      <path d="M6 16c.5-1.5 1.8-2 2-2s1.5.5 2 2M14 9h6M14 13h6M14 17h4" />
    </Icon>
  );
}

export function ChevronRightIcon() {
  return (
    <Icon>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}
