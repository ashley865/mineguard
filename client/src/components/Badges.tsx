import { useTranslation } from "react-i18next";
import { AlertSeverity, AlertStatus, EquipmentStatus, SensorStatus, SiteStatus, WorkerStatus } from "../api/types";

const severityColors: Record<AlertSeverity, string> = {
  LOW: "bg-mine-700 text-mine-100",
  MEDIUM: "bg-hazard-600/80 text-white",
  HIGH: "bg-hazard-500 text-white",
  CRITICAL: "bg-danger-500 text-white",
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const { t } = useTranslation();
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${severityColors[severity]}`}>
      {t(`badges.severity.${severity}`)}
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
  APPROVED: "bg-emerald-600 text-white",
  REJECTED: "bg-danger-500 text-white",
  DRAFT: "bg-mine-600 text-mine-100",
  UNDER_REVIEW: "bg-hazard-500 text-white",
  EXPIRED: "bg-danger-500 text-white",
  WITHDRAWN: "bg-mine-600 text-mine-100",
  COMPLIED: "bg-emerald-600 text-white",
  APPEALED: "bg-hazard-500 text-white",
  SCHEDULED: "bg-mine-600 text-mine-100",
  COMPLETED: "bg-emerald-600 text-white",
  OVERDUE: "bg-danger-500 text-white",
  FIT: "bg-emerald-600 text-white",
  FIT_WITH_RESTRICTION: "bg-hazard-500 text-white",
  TEMPORARILY_UNFIT: "bg-hazard-600/80 text-white",
  UNFIT: "bg-danger-500 text-white",
  PENDING_RENEWAL: "bg-hazard-500 text-white",
  SUSPENDED: "bg-danger-500 text-white",
};

export function StatusBadge({
  status,
}: {
  status: AlertStatus | SensorStatus | SiteStatus | WorkerStatus | EquipmentStatus | string;
}) {
  const { t } = useTranslation();
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColors[status] ?? "bg-mine-600"}`}>
      {t(`badges.status.${status}`, status.replace(/_/g, " "))}
    </span>
  );
}
