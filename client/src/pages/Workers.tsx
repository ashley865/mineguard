import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Site, Worker, WorkerStatus, Zone } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../components/ui";

function WorkerForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: Partial<Worker>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [status, setStatus] = useState<WorkerStatus>(initial?.status ?? "OFF_SHIFT");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [nextOfKinName, setNextOfKinName] = useState(initial?.nextOfKinName ?? "");
  const [nextOfKinRelationship, setNextOfKinRelationship] = useState(initial?.nextOfKinRelationship ?? "");
  const [nextOfKinPhone, setNextOfKinPhone] = useState(initial?.nextOfKinPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name,
        employeeId,
        role,
        phone,
        status,
        siteId,
        zoneId: zoneId || null,
        nextOfKinName: nextOfKinName || undefined,
        nextOfKinRelationship: nextOfKinRelationship || undefined,
        nextOfKinPhone: nextOfKinPhone || undefined,
      });
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to save worker");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.name")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("workers.employeeId")}</label>
          <input className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.role")}</label>
          <input className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.phone")}</label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={inputClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={inputClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as WorkerStatus)}>
          <option value="ON_SHIFT">{t("workers.onShift")}</option>
          <option value="OFF_SHIFT">{t("workers.offShift")}</option>
          <option value="EMERGENCY">{t("workers.emergency")}</option>
        </select>
      </div>
      <div className="border-t border-mine-800 pt-4">
        <div className="text-xs font-semibold text-mine-300 uppercase mb-2">{t("workers.nextOfKin")}</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t("workers.nextOfKinName")}</label>
            <input className={inputClass} value={nextOfKinName} onChange={(e) => setNextOfKinName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("workers.nextOfKinRelationship")}</label>
            <input className={inputClass} value={nextOfKinRelationship} onChange={(e) => setNextOfKinRelationship(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass}>{t("workers.nextOfKinPhone")}</label>
          <input className={inputClass} value={nextOfKinPhone} onChange={(e) => setNextOfKinPhone(e.target.value)} />
        </div>
      </div>
      {error && <div className="text-danger-400 text-sm">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function Workers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | Worker>(null);

  async function load() {
    setLoading(true);
    const [w, s, z] = await Promise.all([
      api.get<Worker[]>("/workers"),
      api.get<Site[]>("/sites"),
      api.get<Zone[]>("/zones"),
    ]);
    setWorkers(w.data);
    setSites(s.data);
    setZones(z.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createWorker(data: any) {
    await api.post("/workers", data);
    setModal(null);
    await load();
  }

  async function updateWorker(id: string, data: any) {
    await api.put(`/workers/${id}`, data);
    setModal(null);
    await load();
  }

  async function deleteWorker(id: string) {
    if (!confirm(t("workers.confirmDelete"))) return;
    await api.delete(`/workers/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("workers.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t("workers.title")}</h1>
          <p className="text-mine-300 text-sm">{t("workers.subtitle")}</p>
        </div>
        {canEdit && sites.length > 0 && (
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("workers.newWorker")}</button>
        )}
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("workers.colName")}</th>
              <th className="text-left px-4 py-2">{t("workers.colEmployeeId")}</th>
              <th className="text-left px-4 py-2">{t("workers.colRole")}</th>
              <th className="text-left px-4 py-2">{t("workers.colSiteZone")}</th>
              <th className="text-left px-4 py-2">{t("workers.colStatus")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{w.name}</td>
                <td className="px-4 py-2 text-mine-300">{w.employeeId}</td>
                <td className="px-4 py-2 text-mine-300">{w.role}</td>
                <td className="px-4 py-2 text-mine-300">
                  {w.site?.name}{w.zone?.name ? ` · ${w.zone.name}` : ""}
                </td>
                <td className="px-4 py-2"><StatusBadge status={w.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(w)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => deleteWorker(w.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("workers.noWorkersYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("workers.newWorkerTitle") : t("workers.editWorkerTitle")} onClose={() => setModal(null)}>
          <WorkerForm
            sites={sites}
            zones={zones}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? createWorker(data) : updateWorker(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
