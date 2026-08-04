import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useEvacuation } from "../context/EvacuationContext";
import { EmergencyEvacuation, Site } from "../api/types";
import Modal from "./Modal";
import { buttonDanger, buttonSecondary, inputClass, labelClass, selectClass } from "./ui";

function TriggerForm({ sites, activeSiteIds, onSubmit, onCancel }: {
  sites: Site[];
  activeSiteIds: Set<string>;
  onSubmit: (data: { siteId: string; assemblyPoint: string; message?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const availableSites = sites.filter((s) => !activeSiteIds.has(s.id));
  const [siteId, setSiteId] = useState(availableSites[0]?.id ?? "");
  const [assemblyPoint, setAssemblyPoint] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ siteId, assemblyPoint, message: message || undefined });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("emergency.evacuationTriggerError"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-danger-500 font-semibold">{t("emergency.evacuationTriggerWarning")}</p>
      <div>
        <label className={labelClass}>{t("common.site")}</label>
        <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={availableSites.length === 0}>
          {availableSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {sites.some((s) => activeSiteIds.has(s.id)) && (
          <p className="text-xs text-mine-400 mt-1">{t("emergency.sitesAlreadyEvacuatingHint")}</p>
        )}
      </div>
      {availableSites.length === 0 ? (
        <p className="text-sm text-mine-400">{t("emergency.allSitesEvacuating")}</p>
      ) : (
        <>
          <div>
            <label className={labelClass}>{t("emergency.assemblyPoint")}</label>
            <input
              className={inputClass}
              value={assemblyPoint}
              onChange={(e) => setAssemblyPoint(e.target.value)}
              placeholder={t("emergency.assemblyPointPlaceholder") ?? ""}
              required
            />
          </div>
          <div>
            <label className={labelClass}>{t("emergency.evacuationMessage")}</label>
            <textarea className={inputClass} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </>
      )}
      {error && <div className="text-danger-400 text-sm">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        {availableSites.length > 0 && (
          <button type="submit" className={buttonDanger} disabled={saving || !assemblyPoint}>
            {saving ? t("common.saving") : t("emergency.triggerEvacuation")}
          </button>
        )}
      </div>
    </form>
  );
}

function DetailsPanel({ active, canCancel, onCancel, onClose }: {
  active: EmergencyEvacuation[];
  canCancel: boolean;
  onCancel: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function handleCancel(id: string) {
    if (!confirm(t("emergency.confirmCancelEvacuation"))) return;
    setCancellingId(id);
    try {
      await onCancel(id);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <Modal title={t(canCancel ? "emergency.deactivateEvacuationTitle" : "emergency.evacuationDetailsTitle")} onClose={onClose}>
      <div className="space-y-3">
        {active.map((e) => (
          <div key={e.id} className="border border-mine-800 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{e.site?.name}</div>
                <div className="text-xs text-mine-400 truncate">{e.assemblyPoint}</div>
              </div>
              {canCancel && (
                <button className={`${buttonDanger} text-xs px-3 py-1.5 shrink-0`} disabled={cancellingId === e.id} onClick={() => handleCancel(e.id)}>
                  {cancellingId === e.id ? t("common.saving") : t("emergency.cancelEvacuation")}
                </button>
              )}
            </div>
            {e.message && <div className="text-xs text-mine-300">{e.message}</div>}
            <div className="text-[10px] text-mine-500">
              {t("emergency.triggeredBy", { name: e.triggeredBy?.name ?? t("common.unknown") })}
              {" · "}
              {new Date(e.triggeredAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function EvacuationSystem() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { active, trigger, cancel } = useEvacuation();
  const canCancel = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [triggerModal, setTriggerModal] = useState(false);
  const [detailsPanel, setDetailsPanel] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);

  async function openTrigger() {
    if (sites.length === 0) {
      const res = await api.get<Site[]>("/sites");
      setSites(res.data);
    }
    setTriggerModal(true);
  }

  async function handleTrigger(data: { siteId: string; assemblyPoint: string; message?: string }) {
    await trigger(data);
    setTriggerModal(false);
  }

  const activeSiteIds = new Set(active.map((e) => e.siteId));

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={openTrigger}
          className="px-3 py-1.5 rounded-lg bg-danger-500 hover:bg-danger-600 active:scale-[0.98] text-white text-xs font-bold uppercase tracking-wide shadow-sm shadow-danger-500/40 transition-all"
        >
          {t("emergency.evacuateButton")}
        </button>
        {active.length > 0 && (
          <button
            type="button"
            onClick={() => setDetailsPanel(true)}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-danger-50 text-danger-700 border border-white active:scale-[0.98] text-xs font-bold uppercase tracking-wide shadow-md transition-all"
          >
            {t(canCancel ? "emergency.deactivateEvacuation" : "emergency.viewEvacuationDetails")}
          </button>
        )}
      </div>

      {triggerModal && (
        <Modal title={t("emergency.triggerEvacuationTitle")} onClose={() => setTriggerModal(false)}>
          <TriggerForm sites={sites} activeSiteIds={activeSiteIds} onSubmit={handleTrigger} onCancel={() => setTriggerModal(false)} />
        </Modal>
      )}

      {detailsPanel && (
        <DetailsPanel active={active} canCancel={canCancel} onCancel={cancel} onClose={() => setDetailsPanel(false)} />
      )}
    </>
  );
}
