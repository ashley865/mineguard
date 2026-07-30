import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { InspectionStatus, SafetyInspection, Site, Zone } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass } from "../../components/ui";

const statuses: InspectionStatus[] = ["SCHEDULED", "COMPLETED", "OVERDUE"];

function InspectionForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: Partial<SafetyInspection>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [inspectionType, setInspectionType] = useState(initial?.inspectionType ?? "");
  const [scheduledDate, setScheduledDate] = useState(initial?.scheduledDate?.slice(0, 10) ?? "");
  const [inspector, setInspector] = useState(initial?.inspector ?? "");
  const [findings, setFindings] = useState(initial?.findings ?? "");
  const [correctiveActions, setCorrectiveActions] = useState(initial?.correctiveActions ?? "");
  const [status, setStatus] = useState<InspectionStatus>(initial?.status ?? "SCHEDULED");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [saving, setSaving] = useState(false);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        title,
        inspectionType,
        scheduledDate,
        inspector,
        findings: findings || undefined,
        correctiveActions: correctiveActions || undefined,
        status,
        siteId,
        zoneId: zoneId || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("compliance.inspection.titleField")}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.inspection.inspectionType")}</label>
          <input className={inputClass} value={inspectionType} onChange={(e) => setInspectionType(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("compliance.inspection.inspector")}</label>
          <input className={inputClass} value={inspector} onChange={(e) => setInspector(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.inspection.scheduledDate")}</label>
          <input className={inputClass} type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as InspectionStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("compliance.inspection.findings")}</label>
        <textarea className={inputClass} value={findings} onChange={(e) => setFindings(e.target.value)} rows={2} />
      </div>
      <div>
        <label className={labelClass}>{t("compliance.inspection.correctiveActions")}</label>
        <textarea className={inputClass} value={correctiveActions} onChange={(e) => setCorrectiveActions(e.target.value)} rows={2} />
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
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function SafetyInspectionsTab({ sites, zones }: { sites: Site[]; zones: Zone[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<SafetyInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | SafetyInspection>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<SafetyInspection[]>("/safety-inspections");
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/safety-inspections", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/safety-inspections/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("compliance.inspection.confirmDelete"))) return;
    await api.delete(`/safety-inspections/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("compliance.loading")}</div>;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("compliance.inspection.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("compliance.inspection.colTitle")}</th>
              <th className="text-left px-4 py-2">{t("compliance.inspection.colType")}</th>
              <th className="text-left px-4 py-2">{t("compliance.inspection.colScheduled")}</th>
              <th className="text-left px-4 py-2">{t("compliance.inspection.colInspector")}</th>
              <th className="text-left px-4 py-2">{t("compliance.inspection.colStatus")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.title}</td>
                <td className="px-4 py-2 text-mine-300">{item.inspectionType}</td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.scheduledDate).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-mine-300">{item.inspector}</td>
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
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("compliance.inspection.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("compliance.inspection.newTitle") : t("compliance.inspection.editTitle")} onClose={() => setModal(null)}>
          <InspectionForm
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
