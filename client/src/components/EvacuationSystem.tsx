import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { EmergencyEvacuation, Site } from "../api/types";
import Modal from "./Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "./ui";

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

function CancelPanel({ active, onCancel, onClose }: {
  active: EmergencyEvacuation[];
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
    <Modal title={t("emergency.deactivateEvacuationTitle")} onClose={onClose}>
      <div className="space-y-3">
        {active.map((e) => (
          <div key={e.id} className="border border-mine-800 rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{e.site?.name}</div>
              <div className="text-xs text-mine-400 truncate">{e.assemblyPoint}</div>
            </div>
            <button className={buttonDanger} disabled={cancellingId === e.id} onClick={() => handleCancel(e.id)}>
              {cancellingId === e.id ? t("common.saving") : t("emergency.cancelEvacuation")}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function EvacuationSystem() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const socket = useSocket();
  const canCancel = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [active, setActive] = useState<EmergencyEvacuation[]>([]);
  const [triggerModal, setTriggerModal] = useState(false);
  const [cancelPanel, setCancelPanel] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);

  async function loadActive() {
    try {
      const res = await api.get<EmergencyEvacuation[]>("/emergency/evacuations/active");
      setActive(res.data);
    } catch {
      // Not a member of a mine yet, or not authenticated — nothing to show.
    }
  }

  useEffect(() => {
    loadActive();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onNew = (evacuation: EmergencyEvacuation) => setActive((prev) => [evacuation, ...prev]);
    const onCancelled = ({ id }: { id: string }) => setActive((prev) => prev.filter((e) => e.id !== id));
    socket.on("emergency:evacuation", onNew);
    socket.on("emergency:evacuation-cancelled", onCancelled);
    return () => {
      socket.off("emergency:evacuation", onNew);
      socket.off("emergency:evacuation-cancelled", onCancelled);
    };
  }, [socket]);

  async function openTrigger() {
    if (sites.length === 0) {
      const res = await api.get<Site[]>("/sites");
      setSites(res.data);
    }
    setTriggerModal(true);
  }

  async function trigger(data: { siteId: string; assemblyPoint: string; message?: string }) {
    await api.post("/emergency/evacuations", data);
    setTriggerModal(false);
  }

  async function cancelEvacuation(id: string) {
    await api.post(`/emergency/evacuations/${id}/cancel`);
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
        {active.length > 0 && canCancel && (
          <button
            onClick={() => setCancelPanel(true)}
            className="px-3 py-1.5 rounded-lg bg-white text-danger-600 border-2 border-danger-500 active:scale-[0.98] text-xs font-bold uppercase tracking-wide animate-evac-blink-subtle transition-all"
          >
            {t("emergency.deactivateEvacuation")}
          </button>
        )}
      </div>

      {triggerModal && (
        <Modal title={t("emergency.triggerEvacuationTitle")} onClose={() => setTriggerModal(false)}>
          <TriggerForm sites={sites} activeSiteIds={activeSiteIds} onSubmit={trigger} onCancel={() => setTriggerModal(false)} />
        </Modal>
      )}

      {cancelPanel && (
        <CancelPanel active={active} onCancel={cancelEvacuation} onClose={() => setCancelPanel(false)} />
      )}

      {active.length > 0 && (
        <div className="fixed inset-0 z-[100] animate-evac-blink animate-evac-border flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-lg w-full text-white text-center space-y-4 py-8">
            <div className="text-5xl">🚨</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wide">
              {t("emergency.evacuationActiveTitle")}
            </h1>
            {active.map((e) => (
              <div key={e.id} className="bg-black/25 rounded-xl p-4 space-y-2 text-left">
                <div className="text-sm font-semibold uppercase tracking-wide">{e.site?.name}</div>
                <div>
                  <div className="text-xs uppercase text-white/70">{t("emergency.assemblyPoint")}</div>
                  <div className="text-lg font-bold">{e.assemblyPoint}</div>
                </div>
                {e.message && (
                  <div>
                    <div className="text-xs uppercase text-white/70">{t("emergency.evacuationMessage")}</div>
                    <div className="text-sm">{e.message}</div>
                  </div>
                )}
                <div className="text-xs text-white/70">
                  {t("emergency.triggeredBy", { name: e.triggeredBy?.name ?? t("common.unknown") })}
                  {" · "}
                  {new Date(e.triggeredAt).toLocaleTimeString()}
                </div>
                {canCancel && (
                  <div className="flex justify-end pt-1">
                    <button
                      className={`${buttonPrimary} !bg-white !text-danger-600 hover:!bg-white/90`}
                      onClick={() => cancelEvacuation(e.id)}
                    >
                      {t("emergency.cancelEvacuation")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
