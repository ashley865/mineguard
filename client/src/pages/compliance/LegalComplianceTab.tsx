import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { LegalComplianceCalendar, LegalComplianceCalendarEntry, LegalComplianceCategory, LegalComplianceItem, LegalComplianceItemStatus, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";

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

  const overdueCount = items.filter((i) => i.status === "OVERDUE").length;
  const dueCount = items.filter((i) => i.status === "DUE").length;

  const calendarColumns: DataTableColumn<LegalComplianceCalendarEntry>[] = [
    { key: "dueDate", header: t("legalCompliance.dueDate"), render: (e) => <span className={e.overdue ? "text-danger-500 font-medium" : "font-medium"}>{new Date(e.dueDate).toLocaleDateString()}</span>, sortValue: (e) => e.dueDate },
    { key: "title", header: t("legalCompliance.title"), render: (e) => e.title, sortValue: (e) => e.title },
    { key: "relatedTo", header: t("legalCompliance.relatedTo"), render: (e) => e.relatedTo, sortValue: (e) => e.relatedTo },
    { key: "source", header: t("legalCompliance.source"), render: (e) => <span className="text-mine-400 text-xs">{t(`legalCompliance.sources.${e.source}`)}</span>, sortValue: (e) => e.source },
  ];

  const itemColumns: DataTableColumn<LegalComplianceItem>[] = [
    { key: "title", header: t("legalCompliance.title"), render: (i) => i.title, sortValue: (i) => i.title },
    { key: "category", header: t("legalCompliance.category"), render: (i) => t(`legalCompliance.categories.${i.category}`), sortValue: (i) => i.category },
    { key: "dueDate", header: t("legalCompliance.dueDate"), render: (i) => new Date(i.dueDate).toLocaleDateString(), sortValue: (i) => i.dueDate },
    { key: "status", header: t("common.status"), render: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-mine-200 mb-1">{t("legalCompliance.calendarTitle")}</h2>
        <p className="text-xs text-mine-400 mb-3">{t("legalCompliance.calendarHint")}</p>
        <DataTable
          columns={calendarColumns}
          rows={calendar?.entries ?? []}
          rowKey={(e) => `${e.source}-${e.id}`}
          emptyMessage={t("legalCompliance.calendarEmpty")}
          searchValue={(e) => `${e.title} ${e.relatedTo}`}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-mine-200">{t("legalCompliance.itemsTitle")}</h2>
          {canEdit && <button className={buttonPrimary} onClick={() => setModal("create")}>{t("legalCompliance.newItem")}</button>}
        </div>

        <SummaryCards
          cards={[
            { label: t("legalCompliance.summaryOverdue"), value: overdueCount, tone: overdueCount > 0 ? "danger" : "default" },
            { label: t("legalCompliance.summaryDue"), value: dueCount, tone: dueCount > 0 ? "hazard" : "default" },
          ]}
        />

        <DataTable
          columns={itemColumns}
          rows={items}
          rowKey={(i) => i.id}
          emptyMessage={t("legalCompliance.noneYet")}
          searchValue={(i) => `${i.title} ${i.category}`}
          exportFilename="legal-compliance-items"
          exportColumns={[
            { header: t("legalCompliance.title"), value: (i) => i.title },
            { header: t("legalCompliance.category"), value: (i) => i.category },
            { header: t("legalCompliance.dueDate"), value: (i) => i.dueDate },
            { header: t("common.status"), value: (i) => i.status },
          ]}
          actions={(i) => (
            <div className="flex justify-end gap-2">
              <AuditHistoryButton entityType="LegalComplianceItem" entityId={i.id} />
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(i)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(i.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
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
