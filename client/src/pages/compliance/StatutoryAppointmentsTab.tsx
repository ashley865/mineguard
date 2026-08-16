import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Site, StatutoryAppointment, StatutoryAppointmentStatus, StatutoryAppointmentType, Worker } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";
import LoadError from "../../components/LoadError";

const appointmentTypes: StatutoryAppointmentType[] = [
  "MINE_MANAGER",
  "MINE_OVERSEER",
  "ENGINEER",
  "SURVEYOR",
  "VENTILATION_OFFICER",
  "HEALTH_SAFETY_OFFICER",
  "BLASTING_OFFICER",
  "ROCK_ENGINEER",
  "ELECTRICAL_ENGINEER",
  "MECHANICAL_ENGINEER",
  "ASSISTANT_MANAGER",
  "ENVIRONMENTAL_CONTROL_OFFICER",
  "OCCUPATIONAL_HYGIENIST",
  "OTHER",
];
const appointmentStatuses: StatutoryAppointmentStatus[] = ["ACTIVE", "VACANT", "SUSPENDED", "EXPIRED", "REVOKED"];

function AppointmentForm({ sites, workers, initial, onSubmit, onCancel }: {
  sites: Site[];
  workers: Worker[];
  initial?: StatutoryAppointment;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [appointmentType, setAppointmentType] = useState<StatutoryAppointmentType>(initial?.appointmentType ?? "MINE_MANAGER");
  const [customTitle, setCustomTitle] = useState(initial?.customTitle ?? "");
  const [legislativeReference, setLegislativeReference] = useState(initial?.legislativeReference ?? "MHSA Section 2.1");
  const [workerId, setWorkerId] = useState(initial?.workerId ?? "");
  const [appointeeName, setAppointeeName] = useState(initial?.appointeeName ?? "");
  const [appointedDate, setAppointedDate] = useState(initial?.appointedDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<StatutoryAppointmentStatus>(initial?.status ?? "ACTIVE");
  const [scopeOfAppointment, setScopeOfAppointment] = useState(initial?.scopeOfAppointment ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  function pickWorker(id: string) {
    setWorkerId(id);
    const w = workers.find((wk) => wk.id === id);
    if (w) setAppointeeName(w.name);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        appointmentType,
        customTitle: appointmentType === "OTHER" ? customTitle || undefined : undefined,
        legislativeReference: legislativeReference || undefined,
        workerId: workerId || null,
        appointeeName,
        appointedDate,
        status,
        scopeOfAppointment: scopeOfAppointment || undefined,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("statutoryAppointments.appointmentType")}</label>
          <select className={selectClass} value={appointmentType} onChange={(e) => setAppointmentType(e.target.value as StatutoryAppointmentType)}>
            {appointmentTypes.map((at) => <option key={at} value={at}>{t(`statutoryAppointments.types.${at}`)}</option>)}
          </select>
        </div>
      </div>
      {appointmentType === "OTHER" && (
        <div>
          <label className={labelClass}>{t("statutoryAppointments.customTitle")}</label>
          <input className={inputClass} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} required />
        </div>
      )}
      <div>
        <label className={labelClass}>{t("statutoryAppointments.legislativeReference")}</label>
        <input className={inputClass} value={legislativeReference} onChange={(e) => setLegislativeReference(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("statutoryAppointments.linkedWorker")}</label>
          <select className={selectClass} value={workerId} onChange={(e) => pickWorker(e.target.value)}>
            <option value="">{t("statutoryAppointments.noLinkedWorker")}</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({t(`workers.categories.${w.category}`)})</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("statutoryAppointments.appointeeName")}</label>
          <input className={inputClass} value={appointeeName} onChange={(e) => setAppointeeName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("statutoryAppointments.appointedDate")}</label>
          <DateField value={appointedDate} onChange={setAppointedDate} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as StatutoryAppointmentStatus)}>
            {appointmentStatuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("statutoryAppointments.scopeOfAppointment")}</label>
        <textarea className={inputClass} rows={2} value={scopeOfAppointment} onChange={(e) => setScopeOfAppointment(e.target.value)} />
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

export default function StatutoryAppointmentsTab({ sites, workers }: { sites: Site[]; workers: Worker[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<StatutoryAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<null | "create" | StatutoryAppointment>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<StatutoryAppointment[]>("/statutory-appointments");
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
    await api.post("/statutory-appointments", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/statutory-appointments/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("statutoryAppointments.confirmDelete"))) return;
    await api.delete(`/statutory-appointments/${id}`);
    await load();
  }

  async function uploadLetter(id: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.item(0);
    if (!file) return;
    setUploadingFor(id);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(`/statutory-appointments/${id}/letter`, form, { headers: { "Content-Type": "multipart/form-data" } });
      await load();
    } finally {
      setUploadingFor(null);
      e.target.value = "";
    }
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const vacantCount = items.filter((a) => a.status === "VACANT").length;
  const expiredCount = items.filter((a) => a.status === "EXPIRED" || a.status === "SUSPENDED" || a.status === "REVOKED").length;

  const columns: DataTableColumn<StatutoryAppointment>[] = [
    { key: "type", header: t("statutoryAppointments.appointmentType"), render: (a) => a.appointmentType === "OTHER" ? a.customTitle : t(`statutoryAppointments.types.${a.appointmentType}`), sortValue: (a) => a.appointmentType },
    { key: "appointee", header: t("statutoryAppointments.appointeeName"), render: (a) => a.appointeeName, sortValue: (a) => a.appointeeName },
    { key: "site", header: t("common.site"), render: (a) => a.site?.name ?? "—", sortValue: (a) => a.site?.name ?? "" },
    { key: "appointedDate", header: t("statutoryAppointments.appointedDate"), render: (a) => new Date(a.appointedDate).toLocaleDateString(), sortValue: (a) => a.appointedDate },
    { key: "status", header: t("common.status"), render: (a) => <StatusBadge status={a.status} />, sortValue: (a) => a.status },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("statutoryAppointments.hint")}</p>

      <SummaryCards
        cards={[
          { label: t("statutoryAppointments.summaryVacant"), value: vacantCount, tone: vacantCount > 0 ? "danger" : "default" },
          { label: t("statutoryAppointments.summaryExpired"), value: expiredCount, tone: expiredCount > 0 ? "hazard" : "default" },
        ]}
      />

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("statutoryAppointments.new")}</button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(a) => a.id}
        emptyMessage={t("statutoryAppointments.noneYet")}
        searchValue={(a) => `${a.appointeeName} ${a.appointmentType} ${a.site?.name ?? ""}`}
        exportFilename="statutory-appointments"
        exportColumns={[
          { header: t("statutoryAppointments.appointmentType"), value: (a) => a.appointmentType },
          { header: t("statutoryAppointments.appointeeName"), value: (a) => a.appointeeName },
          { header: t("common.site"), value: (a) => a.site?.name ?? "" },
          { header: t("statutoryAppointments.appointedDate"), value: (a) => a.appointedDate },
          { header: t("common.status"), value: (a) => a.status },
        ]}
        actions={(a) => (
          <div className="flex justify-end items-center gap-2">
            {a.letterFileName ? (
              <a className="text-xs text-mine-300 hover:text-mine-50" href={`${API_URL}/api/statutory-appointments/${a.id}/letter`} target="_blank" rel="noreferrer">
                {t("statutoryAppointments.viewLetter")}
              </a>
            ) : canEdit ? (
              <label className="text-xs text-mine-300 hover:text-mine-50 cursor-pointer">
                {uploadingFor === a.id ? t("common.saving") : t("statutoryAppointments.uploadLetter")}
                <input type="file" className="hidden" onChange={(e) => uploadLetter(a.id, e)} disabled={uploadingFor === a.id} />
              </label>
            ) : null}
            <AuditHistoryButton entityType="StatutoryAppointment" entityId={a.id} />
            {canEdit && (
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(a)}>{t("common.edit")}</button>
            )}
            {canDelete && (
              <button className={buttonDanger} onClick={() => remove(a.id)}>{t("common.delete")}</button>
            )}
          </div>
        )}
      />

      {modal && (
        <Modal title={modal === "create" ? t("statutoryAppointments.newTitle") : t("statutoryAppointments.editTitle")} onClose={() => setModal(null)}>
          <AppointmentForm
            sites={sites}
            workers={workers}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
