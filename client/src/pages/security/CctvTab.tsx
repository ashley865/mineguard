import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  CameraOperationalStatus,
  CameraType,
  SecurityCamera,
  Site,
  VmsIntegrationMethod,
  Zone,
} from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

const cameraTypes: CameraType[] = ["FIXED", "PTZ", "DOME", "THERMAL", "BODY_WORN", "DRONE", "OTHER"];
const statuses: CameraOperationalStatus[] = ["ONLINE", "OFFLINE", "MAINTENANCE", "DECOMMISSIONED"];
const integrationMethods: VmsIntegrationMethod[] = ["ONVIF", "RTSP_STREAM", "VENDOR_API", "NVR_EXPORT", "NOT_INTEGRATED"];

function CameraForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: Partial<SecurityCamera>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [cameraType, setCameraType] = useState<CameraType>(initial?.cameraType ?? "FIXED");
  const [status, setStatus] = useState<CameraOperationalStatus>(initial?.status ?? "ONLINE");
  const [coverageDescription, setCoverageDescription] = useState(initial?.coverageDescription ?? "");
  const [vmsProvider, setVmsProvider] = useState(initial?.vmsProvider ?? "");
  const [integrationMethod, setIntegrationMethod] = useState<VmsIntegrationMethod>(initial?.integrationMethod ?? "NOT_INTEGRATED");
  const [streamUrl, setStreamUrl] = useState(initial?.streamUrl ?? "");
  const [retentionDays, setRetentionDays] = useState(initial?.retentionDays?.toString() ?? "");
  const [installedDate, setInstalledDate] = useState(initial?.installedDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        zoneId: zoneId || null,
        name,
        location,
        cameraType,
        status,
        coverageDescription: coverageDescription || null,
        vmsProvider: vmsProvider || null,
        integrationMethod,
        streamUrl: streamUrl || null,
        retentionDays: retentionDays ? Number(retentionDays) : null,
        installedDate: installedDate || null,
        notes: notes || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("security.cctv.name")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("security.cctv.location")}</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {zonesForSite.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("security.cctv.cameraType")}</label>
          <select className={selectClass} value={cameraType} onChange={(e) => setCameraType(e.target.value as CameraType)}>
            {cameraTypes.map((ct) => <option key={ct} value={ct}>{t(`security.cctv.cameraTypes.${ct}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as CameraOperationalStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("security.cctv.coverageDescription")}</label>
        <textarea className={inputClass} rows={2} value={coverageDescription} onChange={(e) => setCoverageDescription(e.target.value)} placeholder={t("security.cctv.coverageDescriptionPlaceholder") ?? ""} />
      </div>

      <div className="text-xs font-semibold text-mine-300 uppercase pt-2 border-t border-mine-800">{t("security.cctv.vmsSectionTitle")}</div>
      <p className="text-xs text-mine-400">{t("security.cctv.vmsSectionHint")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("security.cctv.vmsProvider")}</label>
          <input className={inputClass} value={vmsProvider} onChange={(e) => setVmsProvider(e.target.value)} placeholder={t("security.cctv.vmsProviderPlaceholder") ?? ""} />
        </div>
        <div>
          <label className={labelClass}>{t("security.cctv.integrationMethod")}</label>
          <select className={selectClass} value={integrationMethod} onChange={(e) => setIntegrationMethod(e.target.value as VmsIntegrationMethod)}>
            {integrationMethods.map((m) => <option key={m} value={m}>{t(`security.cctv.integrationMethods.${m}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("security.cctv.streamUrl")}</label>
        <input className={inputClass} value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="rtsp://... or https://..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("security.cctv.retentionDays")}</label>
          <input className={inputClass} type="number" min="1" value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("security.cctv.installedDate")}</label>
          <DateField value={installedDate} onChange={setInstalledDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.notes")}</label>
        <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function CctvTab({ sites, zones }: { sites: Site[]; zones: Zone[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<SecurityCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | SecurityCamera>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<SecurityCamera[]>("/security-cameras");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/security-cameras", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/security-cameras/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("security.cctv.confirmDelete"))) return;
    await api.delete(`/security-cameras/${id}`);
    await load();
  }

  async function sync(id: string) {
    await api.post(`/security-cameras/${id}/sync`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("security.cctv.subtitle")}</p>

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("security.cctv.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("security.cctv.colName")}</th>
              <th className="text-left px-4 py-2">{t("security.cctv.location")}</th>
              <th className="text-left px-4 py-2">{t("security.cctv.cameraType")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="text-left px-4 py-2">{t("security.cctv.colVms")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                <td className="px-4 py-2 font-medium">
                  {item.name}
                  <div className="text-[10px] text-mine-400">{item.site?.name}{item.zone ? ` · ${item.zone.name}` : ""}</div>
                </td>
                <td className="px-4 py-2 text-mine-300">{item.location}</td>
                <td className="px-4 py-2 text-mine-300">{t(`security.cctv.cameraTypes.${item.cameraType}`)}</td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-mine-300">
                  {item.integrationMethod === "NOT_INTEGRATED" ? (
                    <span className="text-mine-400 text-xs">{t("security.cctv.integrationMethods.NOT_INTEGRATED")}</span>
                  ) : (
                    <div className="space-y-0.5">
                      <div>{item.vmsProvider || t("security.cctv.integrationMethods." + item.integrationMethod)}</div>
                      <div className="text-[10px] flex items-center gap-1">
                        <StatusBadge status={item.integrationStatus} />
                        {item.lastSyncAt && <span className="text-mine-400">{new Date(item.lastSyncAt).toLocaleString()}</span>}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2 flex-wrap">
                      {item.integrationMethod !== "NOT_INTEGRATED" && (
                        <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => sync(item.id)}>{t("security.cctv.syncNow")}</button>
                      )}
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("security.cctv.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("security.cctv.newTitle") : t("security.cctv.editTitle")} onClose={() => setModal(null)} size="lg">
          <CameraForm
            sites={sites}
            zones={zones}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
