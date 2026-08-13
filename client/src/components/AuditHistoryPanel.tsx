import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { AuditLogEntry } from "../api/types";
import Modal from "./Modal";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-success-500",
  UPDATE: "text-hazard-500",
  DELETE: "text-danger-500",
};

// A drop-in "History" button + modal for any record: pass the Prisma model name (must be
// in server/src/lib/auditLog.ts's AUDITED_MODELS allowlist) and the record's id. Renders
// nothing extra if the caller doesn't render <AuditHistoryButton /> — fully opt-in per page.
export function AuditHistoryButton({ entityType, entityId, label }: { entityType: string; entityId: string; label?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setOpen(true)}>
        {label ?? t("audit.history")}
      </button>
      {open && <AuditHistoryModal entityType={entityType} entityId={entityId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function AuditHistoryModal({ entityType, entityId, onClose }: { entityType: string; entityId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AuditLogEntry[]>("/audit-log", { params: { entityType, entityId } })
      .then((res) => setEntries(res.data))
      .catch(() => setError(t("audit.loadError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  return (
    <Modal title={t("audit.historyTitle")} onClose={onClose}>
      {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
      {error && <div className="text-danger-500 text-sm">{error}</div>}
      {!loading && !error && entries.length === 0 && <div className="text-mine-400 text-sm">{t("audit.noHistory")}</div>}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {entries.map((e) => (
          <div key={e.id} className="border-t border-mine-800 pt-2 first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-semibold ${ACTION_COLORS[e.action] ?? ""}`}>{t(`audit.actions.${e.action}`)}</span>
              <span className="text-mine-400">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
            <div className="text-xs text-mine-400">{e.changedBy?.name ?? t("audit.unknownUser")}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
