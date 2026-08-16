import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { CodeOfPractice, CopCategory, CopStatus, Site, Zone } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import LoadError from "../../components/LoadError";

const categories: CopCategory[] = [
  "ROCK_ENGINEERING",
  "VENTILATION",
  "EXPLOSIVES",
  "FALL_OF_GROUND",
  "TRACKLESS_MOBILE_MACHINERY",
  "WINDING_PLANT",
  "ELECTRICAL",
  "OCCUPATIONAL_HEALTH",
  "EMERGENCY_PREPAREDNESS",
  "OTHER",
];
const statuses: CopStatus[] = ["DRAFT", "ACTIVE", "UNDER_REVIEW", "EXPIRED", "WITHDRAWN"];

function CopForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: Partial<CodeOfPractice>;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<CopCategory>(initial?.category ?? "ROCK_ENGINEERING");
  const [version, setVersion] = useState(initial?.version ?? "1.0");
  const [status, setStatus] = useState<CopStatus>(initial?.status ?? "DRAFT");
  const [effectiveDate, setEffectiveDate] = useState(initial?.effectiveDate?.slice(0, 10) ?? "");
  const [reviewDate, setReviewDate] = useState(initial?.reviewDate?.slice(0, 10) ?? "");
  const [approvedBy, setApprovedBy] = useState(initial?.approvedBy ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
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
        category,
        version,
        status,
        effectiveDate,
        reviewDate,
        approvedBy: approvedBy || undefined,
        description: description || undefined,
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
        <label className={labelClass}>{t("compliance.cop.titleField")}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.cop.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as CopCategory)}>
            {categories.map((c) => (
              <option key={c} value={c}>{t(`compliance.cop.categories.${c}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("compliance.cop.version")}</label>
          <input className={inputClass} value={version} onChange={(e) => setVersion(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.cop.effectiveDate")}</label>
          <DateField value={effectiveDate} onChange={setEffectiveDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("compliance.cop.reviewDate")}</label>
          <DateField value={reviewDate} onChange={setReviewDate} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as CopStatus)}>
            {statuses.map((s) => (
              <option key={s} value={s}>{t(`badges.status.${s}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("compliance.cop.approvedBy")}</label>
          <input className={inputClass} value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
        </div>
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
        <label className={labelClass}>{t("common.description")}</label>
        <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function CodesOfPracticeTab({ sites, zones }: { sites: Site[]; zones: Zone[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<CodeOfPractice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | CodeOfPractice>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<CodeOfPractice[]>("/codes-of-practice");
      setItems(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/codes-of-practice", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/codes-of-practice/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("compliance.cop.confirmDelete"))) return;
    await api.delete(`/codes-of-practice/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("compliance.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("compliance.cop.new")}</button>
        </div>
      )}

      <div className={`${cardClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">{t("compliance.cop.colTitle")}</th>
              <th className="text-left px-4 py-2">{t("compliance.cop.colCategory")}</th>
              <th className="text-left px-4 py-2">{t("compliance.cop.colVersion")}</th>
              <th className="text-left px-4 py-2">{t("compliance.cop.colStatus")}</th>
              <th className="text-left px-4 py-2">{t("compliance.cop.colReviewDate")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                <td className="px-4 py-2 font-medium">{item.title}</td>
                <td className="px-4 py-2 text-mine-300">{t(`compliance.cop.categories.${item.category}`)}</td>
                <td className="px-4 py-2 text-mine-300">{item.version}</td>
                <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-2 text-mine-300">{new Date(item.reviewDate).toLocaleDateString()}</td>
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
              <tr><td colSpan={6} className="px-4 py-6 text-center text-mine-400">{t("compliance.cop.noneYet")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("compliance.cop.newTitle") : t("compliance.cop.editTitle")} onClose={() => setModal(null)}>
          <CopForm
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
