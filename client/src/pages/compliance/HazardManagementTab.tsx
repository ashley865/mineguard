import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, API_URL } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { HazardReport, HazardStatus, HazardType, RiskLevel, Site, Zone } from "../../api/types";
import { StatusBadge, SeverityBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import FileDropzone from "../../components/FileDropzone";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";

const hazardTypes: HazardType[] = [
  "GEOTECHNICAL_ROCKFALL",
  "ELECTRICAL",
  "FIRE_EXPLOSION",
  "CHEMICAL_SPILL",
  "MACHINERY_EQUIPMENT",
  "VENTILATION_AIR_QUALITY",
  "DUST_NOISE",
  "SLIP_TRIP_FALL",
  "WORKING_AT_HEIGHT",
  "CONFINED_SPACE",
  "VEHICLE_TRAFFIC",
  "STRUCTURAL",
  "ERGONOMIC",
  "ENVIRONMENTAL",
  "OTHER",
];
const riskLevels: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: HazardStatus[] = ["OPEN", "IN_PROGRESS", "CLOSED", "OVERDUE"];

interface ResponsiblePerson {
  id: string;
  name: string;
}

function HazardForm({ sites, zones, people, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  people: ResponsiblePerson[];
  initial?: Partial<HazardReport>;
  onSubmit: (form: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [hazardType, setHazardType] = useState<HazardType>(initial?.hazardType ?? "OTHER");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(initial?.riskLevel ?? "MEDIUM");
  const [immediateAction, setImmediateAction] = useState(initial?.immediateAction ?? "");
  const [responsiblePersonId, setResponsiblePersonId] = useState(initial?.responsiblePersonId ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<HazardStatus>(initial?.status ?? "OPEN");
  const [closureEvidence, setClosureEvidence] = useState(initial?.closureEvidence ?? "");
  const [media, setMedia] = useState<FileList | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zonesForSite = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.append("siteId", siteId);
      if (zoneId) form.append("zoneId", zoneId);
      form.append("hazardType", hazardType);
      form.append("location", location);
      form.append("description", description);
      form.append("riskLevel", riskLevel);
      if (immediateAction) form.append("immediateAction", immediateAction);
      if (responsiblePersonId) form.append("responsiblePersonId", responsiblePersonId);
      if (dueDate) form.append("dueDate", dueDate);
      form.append("status", status);
      if (closureEvidence) form.append("closureEvidence", closureEvidence);
      if (media) Array.from(media).forEach((file) => form.append("media", file));
      await onSubmit(form);
    } catch (err: any) {
      setError(err.response?.data?.error ?? t("compliance.hazard.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.hazard.hazardType")}</label>
          <select className={selectClass} value={hazardType} onChange={(e) => setHazardType(e.target.value as HazardType)}>
            {hazardTypes.map((h) => <option key={h} value={h}>{t(`compliance.hazard.types.${h}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("compliance.hazard.riskLevel")}</label>
          <select className={selectClass} value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}>
            {riskLevels.map((r) => <option key={r} value={r}>{t(`badges.severity.${r}`)}</option>)}
          </select>
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
        <label className={labelClass}>{t("compliance.hazard.location")}</label>
        <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} required placeholder={t("compliance.hazard.locationPlaceholder") ?? ""} />
      </div>
      <div>
        <label className={labelClass}>{t("compliance.hazard.description")}</label>
        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus />
      </div>
      <div>
        <label className={labelClass}>{t("compliance.hazard.media")}</label>
        <FileDropzone multiple accept="image/*,video/*" hint={t("compliance.hazard.mediaHint")} onFiles={setMedia} />
        {isEdit && <p className="text-xs text-mine-400 mt-1">{t("compliance.hazard.mediaEditHint")}</p>}
      </div>
      <div>
        <label className={labelClass}>{t("compliance.hazard.immediateAction")}</label>
        <textarea className={inputClass} rows={2} value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("compliance.hazard.responsiblePerson")}</label>
          <select className={selectClass} value={responsiblePersonId} onChange={(e) => setResponsiblePersonId(e.target.value)}>
            <option value="">{t("common.unassigned")}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("compliance.hazard.dueDate")}</label>
          <DateField value={dueDate} onChange={setDueDate} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as HazardStatus)}>
          {statuses.map((s) => <option key={s} value={s}>{t(`badges.status.${s}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("compliance.hazard.closureEvidence")}</label>
        <textarea className={inputClass} rows={2} value={closureEvidence} onChange={(e) => setClosureEvidence(e.target.value)} placeholder={t("compliance.hazard.closureEvidencePlaceholder") ?? ""} />
      </div>
      {error && <div className="text-danger-500 text-xs">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

export default function HazardManagementTab({ sites, zones }: { sites: Site[]; zones: Zone[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canReport = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "VIEWER" || user?.role === "EXECUTIVE";
  const canManage = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<HazardReport[]>([]);
  const [people, setPeople] = useState<ResponsiblePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | HazardReport>(null);

  async function load() {
    setLoading(true);
    const [reports, ppl] = await Promise.all([
      api.get<HazardReport[]>("/hazards"),
      api.get<ResponsiblePerson[]>("/hazards/responsible-people"),
    ]);
    setItems(reports.data);
    setPeople(ppl.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(form: FormData) {
    await api.post("/hazards", form, { headers: { "Content-Type": "multipart/form-data" } });
    setModal(null);
    await load();
  }

  async function update(id: string, form: FormData) {
    const files = (form.getAll("media") as File[]).filter((f) => f.size > 0);
    form.delete("media");
    await api.put(`/hazards/${id}`, Object.fromEntries(form.entries()));
    if (files.length > 0) {
      const mediaForm = new FormData();
      files.forEach((f) => mediaForm.append("media", f));
      await api.post(`/hazards/${id}/media`, mediaForm, { headers: { "Content-Type": "multipart/form-data" } });
    }
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("compliance.hazard.confirmDelete"))) return;
    await api.delete(`/hazards/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("compliance.loading")}</div>;

  const openCount = items.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").length;
  const overdueCount = items.filter((i) => i.status === "OVERDUE").length;
  const criticalCount = items.filter((i) => i.riskLevel === "CRITICAL" && i.status !== "CLOSED").length;

  const columns: DataTableColumn<HazardReport>[] = [
    {
      key: "type",
      header: t("compliance.hazard.colType"),
      render: (item) => (
        <>
          {t(`compliance.hazard.types.${item.hazardType}`)}
          {item.media.length > 0 && <div className="text-[10px] text-mine-400">{t("compliance.hazard.mediaCount", { count: item.media.length })}</div>}
        </>
      ),
      sortValue: (item) => item.hazardType,
    },
    {
      key: "location",
      header: t("compliance.hazard.location"),
      render: (item) => (
        <>
          {item.location}
          <div className="text-[10px] text-mine-400">{item.site?.name}{item.zone ? ` · ${item.zone.name}` : ""}</div>
        </>
      ),
      sortValue: (item) => item.location,
    },
    { key: "risk", header: t("compliance.hazard.riskLevel"), render: (item) => <SeverityBadge severity={item.riskLevel} />, sortValue: (item) => item.riskLevel },
    {
      key: "reportedBy",
      header: t("compliance.hazard.colReportedBy"),
      render: (item) => (
        <>
          {item.reportedBy?.name ?? "—"}
          <div className="text-[10px] text-mine-400">{new Date(item.createdAt).toLocaleString()}</div>
        </>
      ),
      sortValue: (item) => item.reportedBy?.name ?? "",
    },
    { key: "dueDate", header: t("compliance.hazard.dueDate"), render: (item) => (item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"), sortValue: (item) => item.dueDate ?? "" },
    { key: "status", header: t("common.status"), render: (item) => <StatusBadge status={item.status} />, sortValue: (item) => item.status },
  ];

  return (
    <div className="space-y-4">
      <p className="text-mine-300 text-sm">{t("compliance.hazard.subtitle")}</p>

      <SummaryCards
        cards={[
          { label: t("compliance.hazard.summaryOpen"), value: openCount },
          { label: t("compliance.hazard.summaryOverdue"), value: overdueCount, tone: overdueCount > 0 ? "danger" : "default" },
          { label: t("compliance.hazard.summaryCritical"), value: criticalCount, tone: criticalCount > 0 ? "danger" : "default" },
        ]}
      />

      {canReport && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("compliance.hazard.new")}</button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(item) => item.id}
        emptyMessage={t("compliance.hazard.noneYet")}
        searchValue={(item) => `${item.location} ${item.hazardType} ${item.reportedBy?.name ?? ""}`}
        exportFilename="hazard-reports"
        exportColumns={[
          { header: t("compliance.hazard.colType"), value: (item) => item.hazardType },
          { header: t("compliance.hazard.location"), value: (item) => item.location },
          { header: t("compliance.hazard.riskLevel"), value: (item) => item.riskLevel },
          { header: t("compliance.hazard.colReportedBy"), value: (item) => item.reportedBy?.name ?? "" },
          { header: t("compliance.hazard.dueDate"), value: (item) => item.dueDate ?? "" },
          { header: t("common.status"), value: (item) => item.status },
        ]}
        actions={(item) => (
          <div className="flex justify-end gap-2">
            {item.media.map((m) => (
              <a
                key={m.id}
                className="text-xs text-mine-300 hover:text-mine-50"
                href={`${API_URL}/api/hazards/${item.id}/media/${m.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("compliance.hazard.view")}
              </a>
            ))}
            <AuditHistoryButton entityType="HazardReport" entityId={item.id} />
            {canManage && (
              <>
                <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(item)}>{t("common.edit")}</button>
                <button className={buttonDanger} onClick={() => remove(item.id)}>{t("common.delete")}</button>
              </>
            )}
          </div>
        )}
      />

      {modal && (
        <Modal title={modal === "create" ? t("compliance.hazard.newTitle") : t("compliance.hazard.editTitle")} onClose={() => setModal(null)} size="lg">
          <HazardForm
            sites={sites}
            zones={zones}
            people={people}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(form) => (modal === "create" ? create(form) : update(modal.id, form))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
