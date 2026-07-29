import { AlertSeverity, AlertStatus, EquipmentStatus, SensorStatus, SiteStatus, WorkerStatus } from "../api/types";

const severityColors: Record<AlertSeverity, string> = {
  LOW: "bg-mine-700 text-mine-100",
  MEDIUM: "bg-hazard-600/80 text-white",
  HIGH: "bg-hazard-500 text-white",
  CRITICAL: "bg-danger-500 text-white",
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${severityColors[severity]}`}>
      {severity}
    </span>
  );
}

const statusColors: Record<string, string> = {
  OPEN: "bg-danger-500 text-white",
  ACKNOWLEDGED: "bg-hazard-500 text-white",
  RESOLVED: "bg-mine-600 text-mine-100",
  INVESTIGATING: "bg-hazard-500 text-white",
  ACTIVE: "bg-emerald-600 text-white",
  INACTIVE: "bg-mine-600 text-mine-100",
  FAULT: "bg-danger-500 text-white",
  OPERATIONAL: "bg-emerald-600 text-white",
  RESTRICTED: "bg-hazard-500 text-white",
  SHUT_DOWN: "bg-danger-500 text-white",
  ON_SHIFT: "bg-emerald-600 text-white",
  OFF_SHIFT: "bg-mine-600 text-mine-100",
  EMERGENCY: "bg-danger-500 text-white animate-pulse",
  MAINTENANCE: "bg-hazard-500 text-white",
  DOWN: "bg-danger-500 text-white",
};

export function StatusBadge({
  status,
}: {
  status: AlertStatus | SensorStatus | SiteStatus | WorkerStatus | EquipmentStatus | string;
}) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColors[status] ?? "bg-mine-600"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
