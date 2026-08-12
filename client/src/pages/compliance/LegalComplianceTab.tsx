import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { LegalComplianceCalendar, LegalComplianceCategory, LegalComplianceItem, LegalComplianceItemStatus, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";

const categories: LegalComplianceCategory[] = ["MINING_RIGHT", "ENVIRONMENTAL", "WATER_USE", "LABOUR", "HEALTH_SAFETY", "TAX_LEVY", "OTHER"];
const itemStatuses: LegalComplianceItemStatus[] = ["UPCOMING", "DUE", "OVERDUE", "COMPLETED"];

function ItemForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: LegalComplianceItem;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? "");
  const [category, setCategory] = useState<LegalComplianceCategory>(initial?.category ?? "MINING_RIGHT");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [legislativeReference, setLegislativeReference] = useState(initial?.legislativeReference ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<LegalComplianceItemStatus>(initial?.status ?? "UPCOMING");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId: siteId || null,
        category,
        title,
        legislativeReference: legislativeReference || undefined,
        dueDate,
        status,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>{t("legalCompliance.title")}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("legalCompliance.category")}</label>
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as LegalComplianceCategory)}>
            {categories.map((c) => <option key={c} value={c}>{t(`legalCompliance.categories.${c}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">{t("legalCompliance.mineWide")}</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("legalCompliance.legislativeReference")}</label>
          <input className={inputClass} value={legislativeReference} onChange={(e) => setLegislativeReference(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("legalCompliance.dueDate")}</label>
          <DateField value={dueDate} onChange={setDueDate} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as LegalComplianceItemStatus)}>
          {itemStatuses.map((s) => <option key={s} value={s}>{t(`legalCompliance.statuses.${s}`)}</option>)}
        </select>
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

export default function LegalComplianceTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [calendar, setCalendar] = useState<LegalComplianceCalendar | null>(null);
  const [items, setItems] = useState<LegalComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | LegalComplianceItem>(null);

  async function load() {
    setLoading(true);
    const [cal, it] = await Promise.all([
      api.get<LegalComplianceCalendar>("/legal-compliance/calendar", { params: { withinDays: 180 } }),
      api.get<LegalComplianceItem[]>("/legal-compliance/items"),
    ]);
    setCalendar(cal.data);
    setItems(it.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/legal-compliance/items", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/legal-compliance/items/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("legalCompliance.confirmDelete"))) return;
    await api.delete(`/legal-compliance/items/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-mine-200 mb-1">{t("legalCompliance.calendarTitle")}</h2>
        <p className="text-xs text-mine-400 mb-3">{t("legalCompliance.calendarHint")}</p>
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t("legalCompliance.dueDate")}</th>
                <th className="text-left px-4 py-2">{t("legalCompliance.title")}</th>
                <th className="text-left px-4 py-2">{t("legalCompliance.relatedTo")}</th>
                <th className="text-left px-4 py-2">{t("legalCompliance.source")}</th>
              </tr>
            </thead>
            <tbody>
              {calendar?.entries.map((e) => (
                <tr key={`${e.source}-${e.id}`} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className={`px-4 py-2 font-medium ${e.overdue ? "text-danger-500" : ""}`}>{new Date(e.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{e.title}</td>
                  <td className="px-4 py-2 text-mine-300">{e.relatedTo}</td>
                  <td className="px-4 py-2 text-mine-400 text-xs">{t(`legalCompliance.sources.${e.source}`)}</td>
                </tr>
              ))}
              {(!calendar || calendar.entries.length === 0) && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-mine-400">{t("legalCompliance.calendarEmpty")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-mine-200">{t("legalCompliance.itemsTitle")}</h2>
          {canEdit && <button className={buttonPrimary} onClick={() => setModal("create")}>{t("legalCompliance.newItem")}</button>}
        </div>
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-mine-800/50 text-mine-300 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">{t("legalCompliance.title")}</th>
                <th className="text-left px-4 py-2">{t("legalCompliance.category")}</th>
                <th className="text-left px-4 py-2">{t("legalCompliance.dueDate")}</th>
                <th className="text-left px-4 py-2">{t("common.status")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-mine-800 hover:bg-mine-800/30">
                  <td className="px-4 py-2 font-medium">{i.title}</td>
                  <td className="px-4 py-2 text-mine-300">{t(`legalCompliance.categories.${i.category}`)}</td>
                  <td className="px-4 py-2 text-mine-300">{new Date(i.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2"><StatusBadge status={i.status} /></td>
                  <td className="px-4 py-2 text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-2">
                        <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(i)}>{t("common.edit")}</button>
                        {canDelete && <button className={buttonDanger} onClick={() => remove(i.id)}>{t("common.delete")}</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-mine-400">{t("legalCompliance.noneYet")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={modal === "create" ? t("legalCompliance.newItemTitle") : t("legalCompliance.editItemTitle")} onClose={() => setModal(null)}>
          <ItemForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
