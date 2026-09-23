import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { EmergencyEvent, EmergencyEventStatus } from "../api/types";
import { useSocket } from "../context/SocketContext";
import { useEvacuation } from "../context/EvacuationContext";

const UNRESOLVED: EmergencyEventStatus[] = ["ACTIVE", "RESPONDING"];

/**
 * A dashboard-embedded emergency banner, distinct from the header siren bar (Layout.tsx)
 * which only ever shows active evacuations: this also surfaces raw emergency events (fire,
 * gas, injury, etc.) that haven't necessarily escalated to a full evacuation, with enough
 * detail — who reported it, where, when — to act on without leaving the dashboard. Renders
 * nothing at all once everything is cleared or resolved.
 */
export default function LiveEmergencyBanner() {
  const { t } = useTranslation();
  const socket = useSocket();
  const { active: activeEvacuations } = useEvacuation();
  const [events, setEvents] = useState<EmergencyEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      UNRESOLVED.map((status) => api.get<EmergencyEvent[]>("/emergency/events", { params: { status } }).then((r) => r.data).catch(() => []))
    ).then((lists) => {
      if (!cancelled) setEvents(lists.flat());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    function onEvent(event: EmergencyEvent) {
      setEvents((prev) => {
        const withoutIt = prev.filter((e) => e.id !== event.id);
        return UNRESOLVED.includes(event.status) ? [event, ...withoutIt] : withoutIt;
      });
    }
    socket.on("emergency:event", onEvent);
    return () => {
      socket.off("emergency:event", onEvent);
    };
  }, [socket]);

  if (activeEvacuations.length === 0 && events.length === 0) return null;

  return (
    <div className="rounded-[20px] border-2 border-danger-500 bg-danger-500/10 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl animate-pulse" aria-hidden>🚨</span>
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-danger-500">{t("liveOps.emergency.title")}</h2>
      </div>
      <div className="space-y-2">
        {activeEvacuations.map((evac) => (
          <div key={evac.id} className="flex items-start justify-between gap-3 text-xs bg-mine-950/40 rounded-lg px-3 py-2">
            <div className="min-w-0">
              <div className="font-bold text-mine-50">{t("liveOps.emergency.evacuationActive")}</div>
              <div className="text-mine-300 mt-0.5 truncate">
                {evac.site?.name} — {t("liveOps.emergency.assemblyPoint", { point: evac.assemblyPoint })}
              </div>
              {evac.message && <div className="text-mine-400 mt-0.5">{evac.message}</div>}
            </div>
            <span className="text-[10px] text-mine-400 shrink-0 tabular-nums">{new Date(evac.triggeredAt).toLocaleTimeString()}</span>
          </div>
        ))}
        {events.map((event) => (
          <div key={event.id} className="flex items-start justify-between gap-3 text-xs bg-mine-950/40 rounded-lg px-3 py-2">
            <div className="min-w-0">
              <div className="font-bold text-mine-50">
                {t(`emergency.event.types.${event.eventType}`)} — {t(`badges.status.${event.status}`)}
              </div>
              <div className="text-mine-300 mt-0.5 truncate">{event.site?.name} — {event.location}</div>
              {event.reportedBy && <div className="text-mine-400 mt-0.5">{t("liveOps.emergency.reportedBy", { name: event.reportedBy.name })}</div>}
            </div>
            <span className="text-[10px] text-mine-400 shrink-0 tabular-nums">{new Date(event.occurredAt).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
