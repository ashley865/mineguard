import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Shared pulsing "Live" indicator for anything on the dashboard driven by socket events
 * rather than a one-off page load — the same visual language everywhere so a GM learns
 * once what the dot means instead of every widget inventing its own.
 *
 * Pass `asOf` (rather than a pre-formatted `label`) whenever the text is a relative time —
 * this component ticks its own 30s timer to keep it fresh, so the caller doesn't need to.
 */
export default function LivePulse({ connected, label, asOf }: { connected: boolean; label?: string; asOf?: Date | null }) {
  const { t } = useTranslation();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!asOf) return;
    const id = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(id);
  }, [asOf]);

  const text = asOf ? t("liveOps.lastUpdated", { time: formatTimeAgo(asOf, t) }) : label ?? (connected ? t("liveOps.live") : t("liveOps.reconnecting"));

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-bold">
      <span className="relative flex h-2 w-2 shrink-0">
        {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? "bg-success-500" : "bg-mine-500"}`} />
      </span>
      <span className={connected ? "text-success-500" : "text-mine-400"}>{text}</span>
    </span>
  );
}

export function formatTimeAgo(date: Date | string, t: (key: string, opts?: any) => string): string {
  const secs = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 45) return t("liveOps.justNow");
  if (secs < 3600) return t("liveOps.minutesAgo", { count: Math.floor(secs / 60) });
  if (secs < 86400) return t("liveOps.hoursAgo", { count: Math.floor(secs / 3600) });
  return t("liveOps.daysAgo", { count: Math.floor(secs / 86400) });
}
