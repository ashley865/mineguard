import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  AlertSeverity,
  IncidentStatus,
  SecurityIncident,
  SecurityIncidentCategory,
  Site,
  Zone,
} from "../../api/types";
import { StatusBadge, SeverityBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";

const categories: SecurityIncidentCategory[] = [
  "THEFT",
  "UNAUTHORISED_ACCESS",
  "TRESPASSING",
  "VANDALISM",
  "ASSAULT",
  "PROPERTY_DAMAGE",
  "SUSPICIOUS_ACTIVITY",
  "MISSING_EQUIPMENT",
  "VEHICLE_INCIDENT",
  "PERIMETER_BREACH",
  "FRAUD_MISCONDUCT",
  "EMERGENCY",
  "OTHER",
];
const severities: AlertSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: IncidentStatus[] = ["OPEN", "INVESTIGATING", "RESOLVED"];

function IncidentForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: Partial<SecurityIncident>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [category, setCategory] = useState<SecurityIncidentCategory>(initial?.category ?? "SUSPICIOUS_ACTIVITY");
  const [severity, setSeverity] = useState<AlertSeverity>(initial?.severity ?? "MEDIUM");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [status, setStatus] = useState<IncidentStatus>(initial?.status ?? "OPEN");
  const [actionsTaken, setActionsTaken] = useState(initial?.actionsTaken ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        zoneId: zoneId || null,
        category,
        severity,
        description,
        location: location || null,
        status,
        actionsTaken: actionsTaken || null,
      });
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("security.incidents.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("security.incidents.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as SecurityIncidentCategory)}>
            {categories.map((c) => <option key={c} value={c}>{t(`security.incidents.categories.${c}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("security.incidents.severity")}</label>
          <select className={selectClass} value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)}>
            {severities.map((s) => <option key={s} value={s}>{t(`badges.severity.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("security.incidents.description")}</label>
        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus />
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
        <label className={labelClass}>{t("security.incidents.location")}</label>
        <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("security.incidents.locationPlaceholder") ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("security.incidents.actionsTaken")}</label>
        <textarea className={inputClass} rows={2} value={actionsTaken} onChange={(e) => setActionsTaken(e.target.value)} />
      </div>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function IncidentManagementTab({ sites, zones }: { sites: Site[]; zones: Zone[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | SecurityIncident>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<SecurityIncident[]>("/security-incidents");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/security-incidents", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/security-incidents/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("security.incidents.confirmDelete"))) return;
    await api.delete(`/security-incidents/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("security.incidents.subtitle")}</p>

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("security.incidents.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("security.incidents.colOccurred")}</th>
              <th className="text-left px-4 py-2">{t("security.incidents.category")}</th>
              <th className="text-left px-4 py-2">{t("security.incidents.severity")}</th>
              <th className="text-left px-4 py-2">{t("security.incidents.description")}</th>
              <th className="text-left px-4 py-2">{t("security.incidents.colReportedBy")}</th>
              <th className="text-left px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30 align-top">
                <td className="px-4 py-2 text-mine-300">{new Date(item.occurredAt).toLocaleString()}</td>
                <td className="px-4 py-2 font-medium">
                  {t(`security.incidents.categories.${item.category}`)}
                  <div className="text-[10px] text-mine-400">{item.site?.name}{item.zone ? ` · ${item.zone.name}` : ""}{item.location ? ` · ${item.location}` : ""}</div>
                </td>
                <td className="px-4 py-2"><SeverityBadge severity={item.severity} /></td>
                <td className="px-4 py-2 text-mine-300 max-w-xs">
                  <div className="truncate" title={item.description}>{item.description}</div>
                </td>
                <td className="px-4 py-2 text-mine-300">{item.reportedBy?.name ?? "—"}</td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                      <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-mine-400">{t("security.incidents.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("security.incidents.newTitle") : t("security.incidents.editTitle")} onClose={() => setModal(null)} size="lg">
          <IncidentForm
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
