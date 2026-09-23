import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSocket, useSocketConnected } from "../context/SocketContext";
import { Alert, DowntimeEvent, Equipment, EmergencyEvacuation, EmergencyEvent, ExecutiveRequestItem, Incident, MaintenanceSchedule, ShiftHandover, Visitor } from "../api/types";
import LivePulse, { formatTimeAgo } from "./LivePulse";

type Tone = "critical" | "warning" | "info" | "success";

type FeedItem = {
  id: string;
  tone: Tone;
  title: string;
  detail?: string;
  at: Date;
};

const TONE_DOT: Record<Tone, string> = {
  critical: "bg-danger-500",
  warning: "bg-hazard-500",
  info: "bg-mine-400",
  success: "bg-success-500",
};

const MAX_ITEMS = 30;

function severityTone(severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"): Tone {
  return severity === "CRITICAL" || severity === "HIGH" ? "critical" : severity === "MEDIUM" ? "warning" : "info";
}

/**
 * A live, session-scoped feed of what's happening across the mine right now — new alerts,
 * incident/alert reviews, visitor arrivals, executive requests and emergency events, all
 * pushed the instant they occur rather than waiting for a manual refresh. It only shows
 * activity since this page was opened; it isn't a history browser (Alerts/Incidents pages
 * already are that) — the point here is presence, not completeness.
 */
export default function LiveActivityFeed() {
  const { t } = useTranslation();
  const socket = useSocket();
  const connected = useSocketConnected();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!socket) return;

    function push(tone: Tone, title: string, detail?: string) {
      seq.current += 1;
      setItems((prev) => [{ id: `${Date.now()}-${seq.current}`, tone, title, detail, at: new Date() }, ...prev].slice(0, MAX_ITEMS));
    }

    const onAlertNew = (alert: Alert) => push(severityTone(alert.severity), t("liveOps.feed.newAlert", { severity: t(`badges.severity.${alert.severity}`) }), alert.message);
    const onAlertUpdated = (alert: Alert) => {
      if (alert.reviewStatus !== "PENDING") {
        push(alert.reviewStatus === "APPROVED" ? "success" : "warning", t("liveOps.feed.alertReviewed", { status: t(`badges.status.${alert.reviewStatus}`) }));
      } else if (alert.status === "ACKNOWLEDGED") {
        push("info", t("liveOps.feed.alertAcknowledged"));
      } else if (alert.status === "RESOLVED") {
        push("success", t("liveOps.feed.alertResolved"));
      }
    };
    const onIncidentUpdated = (incident: Incident) =>
      push(incident.reviewStatus === "APPROVED" ? "success" : "warning", t("liveOps.feed.incidentReviewed"), incident.title);
    const onVisitorPending = (visitor: Visitor) =>
      push("info", t("liveOps.feed.visitorPending"), `${visitor.fullName} — ${visitor.site?.name ?? ""} (${t("liveOps.feed.hostedBy", { name: visitor.hostName })})`);
    const onRequestNew = (request: ExecutiveRequestItem) =>
      push("info", t("liveOps.feed.newRequest", { name: request.fromUser.name }), request.subject);
    const onEvacuation = (evac: EmergencyEvacuation) =>
      push("critical", t("liveOps.feed.evacuationTriggered"), `${evac.site?.name ?? ""} — ${evac.assemblyPoint}`);
    const onEvacuationCancelled = () => push("success", t("liveOps.feed.evacuationCancelled"));
    const onEmergencyEvent = (event: EmergencyEvent) => {
      if (event.status === "RESOLVED" || event.status === "CONTAINED") {
        push("success", t("liveOps.feed.emergencyResolved", { type: t(`emergency.event.types.${event.eventType}`) }), event.site?.name ?? "");
      } else {
        push("critical", t("liveOps.feed.emergencyReported", { type: t(`emergency.event.types.${event.eventType}`) }), `${event.site?.name ?? ""} — ${event.location}`);
      }
    };
    const onEquipmentUpdated = (payload: Equipment | { id: string; deleted: true }) => {
      if ("deleted" in payload) return;
      if (payload.status === "DOWN") push("critical", t("liveOps.feed.equipmentDown"), payload.name);
      else push("info", t("liveOps.feed.equipmentUpdated", { status: t(`badges.status.${payload.status}`) }), payload.name);
    };
    const onDowntimeUpdated = (payload: DowntimeEvent | { id: string; deleted: true }) => {
      if ("deleted" in payload) return;
      if (payload.endedAt) push("success", t("liveOps.feed.downtimeEnded"), payload.description);
      else push("critical", t("liveOps.feed.downtimeStarted", { category: t(`operationsDashboard.downtimeCategories.${payload.category}`, payload.category) }), payload.description);
    };
    const onMaintenanceUpdated = (payload: MaintenanceSchedule | { id: string; deleted: true }) => {
      if ("deleted" in payload) return;
      if (payload.status === "COMPLETED") push("success", t("liveOps.feed.maintenanceCompleted"), payload.equipment?.name);
      else if (payload.status === "OVERDUE") push("critical", t("liveOps.feed.maintenanceOverdue"), payload.equipment?.name);
      else push("info", t("liveOps.feed.maintenanceScheduled"), payload.equipment?.name);
    };
    const onHandoverNew = (handover: ShiftHandover) =>
      push(handover.actionItems ? "warning" : "info", t("liveOps.feed.handoverLogged", { name: handover.outgoingSupervisor }), handover.site?.name);

    socket.on("alert:new", onAlertNew);
    socket.on("alert:updated", onAlertUpdated);
    socket.on("incident:updated", onIncidentUpdated);
    socket.on("visitor:pending", onVisitorPending);
    socket.on("request:new", onRequestNew);
    socket.on("emergency:evacuation", onEvacuation);
    socket.on("emergency:evacuation-cancelled", onEvacuationCancelled);
    socket.on("emergency:event", onEmergencyEvent);
    socket.on("equipment:updated", onEquipmentUpdated);
    socket.on("downtime:updated", onDowntimeUpdated);
    socket.on("maintenance:updated", onMaintenanceUpdated);
    socket.on("handover:new", onHandoverNew);

    return () => {
      socket.off("alert:new", onAlertNew);
      socket.off("alert:updated", onAlertUpdated);
      socket.off("incident:updated", onIncidentUpdated);
      socket.off("visitor:pending", onVisitorPending);
      socket.off("request:new", onRequestNew);
      socket.off("emergency:evacuation", onEvacuation);
      socket.off("emergency:evacuation-cancelled", onEvacuationCancelled);
      socket.off("emergency:event", onEmergencyEvent);
      socket.off("equipment:updated", onEquipmentUpdated);
      socket.off("downtime:updated", onDowntimeUpdated);
      socket.off("maintenance:updated", onMaintenanceUpdated);
      socket.off("handover:new", onHandoverNew);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  return (
    <div className="bg-mine-900 border border-mine-800 rounded-[20px] shadow-sm shadow-black/5 p-6 flex flex-col min-h-[280px]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-mine-50">{t("liveOps.feed.title")}</h2>
        <LivePulse connected={connected} />
      </div>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-mine-400 text-center px-4">
          {t("liveOps.feed.empty")}
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5 text-xs border-t border-mine-800 pt-2.5 first:border-t-0 first:pt-0">
              <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${TONE_DOT[item.tone]}`} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-mine-50 truncate">{item.title}</div>
                {item.detail && <div className="text-mine-400 truncate">{item.detail}</div>}
              </div>
              <div className="text-[10px] text-mine-500 shrink-0 tabular-nums">{formatTimeAgo(item.at, t)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
