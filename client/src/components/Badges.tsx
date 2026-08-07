import { useTranslation } from "react-i18next";
import { AlertSeverity, AlertStatus, EquipmentStatus, SensorStatus, SiteStatus, WorkerStatus } from "../api/types";

const severityColors: Record<AlertSeverity, string> = {
  LOW: "bg-mine-300 text-white",
  MEDIUM: "bg-hazard-500 text-white",
  HIGH: "bg-danger-400 text-white",
  CRITICAL: "bg-danger-600 text-white",
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
  ACTIVE: "bg-success-600 text-white",
  INACTIVE: "bg-mine-600 text-mine-100",
  FAULT: "bg-danger-500 text-white",
  OPERATIONAL: "bg-success-600 text-white",
  RESTRICTED: "bg-hazard-500 text-white",
  SHUT_DOWN: "bg-danger-500 text-white",
  ON_SHIFT: "bg-success-600 text-white",
  OFF_SHIFT: "bg-mine-600 text-mine-100",
  EMERGENCY: "bg-danger-500 text-white animate-pulse",
  MAINTENANCE: "bg-hazard-500 text-white",
  DOWN: "bg-danger-500 text-white",
  APPROVED: "bg-success-600 text-white",
  REJECTED: "bg-danger-500 text-white",
  DRAFT: "bg-mine-600 text-mine-100",
  UNDER_REVIEW: "bg-hazard-500 text-white",
  EXPIRED: "bg-danger-500 text-white",
  WITHDRAWN: "bg-mine-600 text-mine-100",
  COMPLIED: "bg-success-600 text-white",
  APPEALED: "bg-hazard-500 text-white",
  SCHEDULED: "bg-mine-600 text-mine-100",
  COMPLETED: "bg-success-600 text-white",
  OVERDUE: "bg-danger-500 text-white",
  FIT: "bg-success-600 text-white",
  FIT_WITH_RESTRICTION: "bg-hazard-500 text-white",
  TEMPORARILY_UNFIT: "bg-hazard-600/80 text-white",
  UNFIT: "bg-danger-500 text-white",
  PENDING_RENEWAL: "bg-hazard-500 text-white",
  SUSPENDED: "bg-danger-500 text-white",
  ARCHIVED: "bg-mine-600 text-mine-100",
  IN_PROGRESS: "bg-hazard-500 text-white",
  MITIGATED: "bg-success-600 text-white",
  ACCEPTED: "bg-mine-600 text-mine-100",
  TERMINATED: "bg-danger-500 text-white",
  CHECKED_IN: "bg-success-600 text-white",
  CHECKED_OUT: "bg-mine-600 text-mine-100",
  DENIED: "bg-danger-500 text-white",
  PENDING_APPROVAL: "bg-hazard-500 text-white",
  PENDING_SUPERVISOR: "bg-hazard-500 text-white",
  PENDING_EXECUTIVE: "bg-hazard-600/80 text-white",
  CLOSED: "bg-mine-600 text-mine-100",
  ORDERED: "bg-hazard-500 text-white",
  RECEIVED: "bg-success-600 text-white",
  BLACKLISTED: "bg-danger-600 text-white",
  COMPLIANT: "bg-success-600 text-white",
  NON_COMPLIANT: "bg-danger-500 text-white",
  NOT_APPLICABLE: "bg-mine-600 text-mine-100",
  AWAITING_VERIFICATION: "bg-hazard-500 text-white",
  VERIFIED: "bg-success-600 text-white",
  ONLINE: "bg-success-600 text-white",
  OFFLINE: "bg-danger-500 text-white",
  DECOMMISSIONED: "bg-mine-600 text-mine-100",
  CONNECTED: "bg-success-600 text-white",
  DISCONNECTED: "bg-danger-500 text-white",
  RESPONDING: "bg-hazard-500 text-white",
  CONTAINED: "bg-hazard-600/80 text-white",
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
