import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { api, API_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Site, StaffCategory, Worker, WorkerStatus, Zone } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import Avatar from "../components/Avatar";
import WorkerProfileModal from "../components/WorkerProfileModal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../components/ui";

const staffCategories: StaffCategory[] = [
  "MINING_OPERATIONS",
  "ENGINEERING_TECHNICAL",
  "DRIVER",
  "CLEANER",
  "SECURITY",
  "ADMINISTRATION",
  "EXECUTIVE",
  "MEDICAL",
  "SAFETY_HEALTH",
  "MAINTENANCE",
  "CATERING",
  "OTHER",
];

function WorkerQrModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(`worker:${worker.id}`, { width: 220, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [worker.id]);

  return (
    <Modal title={t("workers.badgeTitle", { name: worker.name })} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 text-center">
        {dataUrl && <img src={dataUrl} alt="Worker QR badge" className="rounded-md border border-mine-800" />}
        <div className="text-sm font-medium">{worker.name}</div>
        <div className="text-xs text-mine-400">{worker.employeeId}</div>
        <p className="text-xs text-mine-400 max-w-xs">{t("workers.badgeHint")}</p>
      </div>
    </Modal>
  );
}

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
  const [category, setCategory] = useState<StaffCategory>(initial?.category ?? "OTHER");
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
        category,
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
          <label className={labelClass}>{t("workers.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as StaffCategory)}>
            {staffCategories.map((c) => <option key={c} value={c}>{t(`workers.categories.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.phone")}</label>
        <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as WorkerStatus)}>
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
  const [qrWorker, setQrWorker] = useState<Worker | null>(null);
  const [profileWorker, setProfileWorker] = useState<Worker | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");

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

  async function toggleAttendance(id: string) {
    await api.post(`/workers/${id}/toggle-attendance`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("workers.loading")}</div>;

  const filteredWorkers = workers.filter((w) => !categoryFilter || w.category === categoryFilter);
  const actionButtonClass = "px-2.5 py-1 rounded-lg text-xs font-medium text-mine-300 hover:text-mine-50 hover:bg-mine-800 transition-colors";

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

      <div className={`${cardClass} p-4 flex items-center justify-between flex-wrap gap-3`}>
        <select className={`${selectClass} max-w-xs`} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">{t("workers.allCategories")}</option>
          {staffCategories.map((c) => <option key={c} value={c}>{t(`workers.categories.${c}`)}</option>)}
        </select>
        <span className="text-xs text-mine-400">{t("workers.showingCount", { count: filteredWorkers.length })}</span>
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">{t("workers.colName")}</th>
              <th className="text-left px-4 py-3">{t("workers.colEmployeeId")}</th>
              <th className="text-left px-4 py-3">{t("workers.colRole")}</th>
              <th className="text-left px-4 py-3">{t("workers.colCategory")}</th>
              <th className="text-left px-4 py-3">{t("workers.colSiteZone")}</th>
              <th className="text-left px-4 py-3">{t("workers.colStatus")}</th>
              <th className="text-left px-4 py-3">{t("workers.colCheckIn")}</th>
              <th className="text-left px-4 py-3">{t("workers.colHoursWeek")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mine-800">
            {filteredWorkers.map((w) => (
              <tr key={w.id} className="hover:bg-mine-800/30 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <button className="flex items-center gap-2.5 hover:underline" onClick={() => setProfileWorker(w)}>
                    <Avatar size={30} name={w.name} src={w.hasPhoto ? `${API_URL}/api/workers/${w.id}/photo` : null} />
                    {w.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-mine-300">{w.employeeId}</td>
                <td className="px-4 py-3 text-mine-300">{w.role}</td>
                <td className="px-4 py-3 text-mine-300">{t(`workers.categories.${w.category}`)}</td>
                <td className="px-4 py-3 text-mine-300">
                  {w.site?.name}{w.zone?.name ? ` · ${w.zone.name}` : ""}
                </td>
                <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                <td className="px-4 py-3 text-mine-300">
                  {w.currentCheckInAt
                    ? new Date(w.currentCheckInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${(w.hoursThisWeek ?? 0) > 0 ? "text-mine-100" : "text-mine-400"}`}>
                    {(w.hoursThisWeek ?? 0).toFixed(1)}h
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-1">
                    <button className={actionButtonClass} onClick={() => setProfileWorker(w)}>{t("workers.viewProfile")}</button>
                    <button className={actionButtonClass} onClick={() => setQrWorker(w)}>{t("workers.showBadge")}</button>
                    {canEdit && (
                      <button
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          w.status === "ON_SHIFT"
                            ? "bg-success-600/15 text-success-400 hover:bg-success-600/25"
                            : "text-mine-300 hover:text-mine-50 hover:bg-mine-800"
                        }`}
                        onClick={() => toggleAttendance(w.id)}
                      >
                        {w.status === "ON_SHIFT" ? t("workers.checkOut") : t("workers.checkIn")}
                      </button>
                    )}
                    {canEdit && (
                      <button className={actionButtonClass} onClick={() => setModal(w)}>{t("common.edit")}</button>
                    )}
                    {canEdit && (
                      <button className={buttonDanger} onClick={() => deleteWorker(w.id)}>{t("common.delete")}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {workers.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-mine-400">{t("workers.noWorkersYet")}</td></tr>
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

      {qrWorker && <WorkerQrModal worker={qrWorker} onClose={() => setQrWorker(null)} />}

      {profileWorker && (
        <WorkerProfileModal
          worker={profileWorker}
          canEdit={canEdit}
          onClose={() => setProfileWorker(null)}
          onPhotoChanged={load}
        />
      )}
    </div>
  );
}
