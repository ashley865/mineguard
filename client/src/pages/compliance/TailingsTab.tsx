import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { DamStructuralRating, Site, TailingsFacility, TailingsInspection } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import SummaryCards from "../../components/SummaryCards";
import { AuditHistoryButton } from "../../components/AuditHistoryPanel";

const structuralRatings: DamStructuralRating[] = ["SATISFACTORY", "FAIR", "POOR", "UNSATISFACTORY", "UNKNOWN"];

function FacilityForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: TailingsFacility;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [facilityType, setFacilityType] = useState(initial?.facilityType ?? "");
  const [designCapacity, setDesignCapacity] = useState(initial?.designCapacity?.toString() ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "m3");
  const [engineerOfRecord, setEngineerOfRecord] = useState(initial?.engineerOfRecord ?? "");
  const [gistmClassification, setGistmClassification] = useState(initial?.gistmClassification ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        name,
        facilityType: facilityType || undefined,
        designCapacity: designCapacity ? Number(designCapacity) : null,
        unit: unit || undefined,
        engineerOfRecord: engineerOfRecord || undefined,
        gistmClassification: gistmClassification || undefined,
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
          <label className={labelClass}>{t("tailings.facilityName")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("tailings.facilityType")}</label>
          <input className={inputClass} value={facilityType} onChange={(e) => setFacilityType(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("tailings.designCapacity")}</label>
          <input className={inputClass} type="number" step="any" value={designCapacity} onChange={(e) => setDesignCapacity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("inventory.unit")}</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("tailings.engineerOfRecord")}</label>
          <input className={inputClass} value={engineerOfRecord} onChange={(e) => setEngineerOfRecord(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("tailings.gistmClassification")}</label>
          <input className={inputClass} value={gistmClassification} onChange={(e) => setGistmClassification(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function InspectionsModal({ facility, onClose, onChanged }: { facility: TailingsFacility; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [inspections, setInspections] = useState<TailingsInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspector, setInspector] = useState("");
  const [freeboardMeters, setFreeboardMeters] = useState("");
  const [seepageObserved, setSeepageObserved] = useState(false);
  const [structuralRating, setStructuralRating] = useState<DamStructuralRating>("SATISFACTORY");
  const [engineerSignOff, setEngineerSignOff] = useState(false);
  const [engineerSignOffName, setEngineerSignOffName] = useState("");
  const [findings, setFindings] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await api.get<TailingsInspection[]>("/tailings/inspections", { params: { facilityId: facility.id } });
    setInspections(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/tailings/inspections", {
        facilityId: facility.id,
        inspectionDate,
        inspector,
        freeboardMeters: freeboardMeters ? Number(freeboardMeters) : null,
        seepageObserved,
        structuralRating,
        engineerSignOff,
        engineerSignOffName: engineerSignOff ? engineerSignOffName : undefined,
        engineerSignOffDate: engineerSignOff ? new Date().toISOString() : null,
        findings: findings || undefined,
      });
      setInspectionDate("");
      setInspector("");
      setFreeboardMeters("");
      setSeepageObserved(false);
      setFindings("");
      await load();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("tailings.inspectionsFor", { name: facility.name })} onClose={onClose}>
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3 border border-mine-800 rounded-md p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("tailings.inspectionDate")}</label>
              <DateField value={inspectionDate} onChange={setInspectionDate} required />
            </div>
            <div>
              <label className={labelClass}>{t("tailings.inspector")}</label>
              <input className={inputClass} value={inspector} onChange={(e) => setInspector(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("tailings.freeboardMeters")}</label>
              <input className={inputClass} type="number" step="any" value={freeboardMeters} onChange={(e) => setFreeboardMeters(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("tailings.structuralRating")}</label>
              <select className={selectClass} value={structuralRating} onChange={(e) => setStructuralRating(e.target.value as DamStructuralRating)}>
                {structuralRatings.map((r) => <option key={r} value={r}>{t(`tailings.structuralRatings.${r}`)}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={seepageObserved} onChange={(e) => setSeepageObserved(e.target.checked)} />
            {t("tailings.seepageObserved")}
          </label>
          <div>
            <label className={labelClass}>{t("tailings.findings")}</label>
            <textarea className={inputClass} rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={engineerSignOff} onChange={(e) => setEngineerSignOff(e.target.checked)} />
            {t("tailings.engineerSignOff")}
          </label>
          {engineerSignOff && (
            <input className={inputClass} placeholder={t("tailings.engineerOfRecord") ?? ""} value={engineerSignOffName} onChange={(e) => setEngineerSignOffName(e.target.value)} required />
          )}
          <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
        </form>

        {loading && <div className="text-mine-300 text-sm">{t("common.loading")}</div>}
        {!loading && inspections.length === 0 && <div className="text-mine-400 text-sm">{t("tailings.noInspections")}</div>}
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {inspections.map((insp) => (
            <div key={insp.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5">
              <span>{new Date(insp.inspectionDate).toLocaleDateString()} — {insp.inspector}</span>
              <span className="text-mine-300">{t(`tailings.structuralRatings.${insp.structuralRating}`)}</span>
              <span className={insp.seepageObserved ? "text-danger-500" : "text-mine-400"}>
                {insp.seepageObserved ? t("tailings.seepageObserved") : "—"}
              </span>
              <span className="text-mine-500">{insp.engineerSignOff ? "✓" : "—"}</span>
              <AuditHistoryButton entityType="TailingsInspection" entityId={insp.id} />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function TailingsTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [facilities, setFacilities] = useState<TailingsFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "create" | TailingsFacility>(null);
  const [inspectionsFacility, setInspectionsFacility] = useState<TailingsFacility | null>(null);

  async function load() {
    setLoading(true);
    const res = await api.get<TailingsFacility[]>("/tailings/facilities");
    setFacilities(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(data: any) {
    await api.post("/tailings/facilities", data);
    setModal(null);
    await load();
  }

  async function update(id: string, data: any) {
    await api.put(`/tailings/facilities/${id}`, data);
    setModal(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm(t("tailings.confirmDelete"))) return;
    await api.delete(`/tailings/facilities/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;

  const poorRatingCount = facilities.filter((f) => f.inspections && f.inspections.length > 0 && (f.inspections[0].structuralRating === "POOR" || f.inspections[0].structuralRating === "UNSATISFACTORY")).length;
  const seepageCount = facilities.filter((f) => f.inspections && f.inspections.length > 0 && f.inspections[0].seepageObserved).length;

  const columns: DataTableColumn<TailingsFacility>[] = [
    { key: "name", header: t("tailings.facilityName"), render: (f) => f.name, sortValue: (f) => f.name },
    { key: "site", header: t("common.site"), render: (f) => f.site?.name ?? "—", sortValue: (f) => f.site?.name ?? "" },
    {
      key: "rating",
      header: t("tailings.lastRating"),
      render: (f) => (f.inspections && f.inspections.length > 0 ? <StatusBadge status={f.inspections[0].structuralRating} /> : "—"),
      sortValue: (f) => f.inspections?.[0]?.structuralRating ?? "",
    },
    {
      key: "lastInspection",
      header: t("tailings.lastInspection"),
      render: (f) => (f.inspections && f.inspections.length > 0 ? new Date(f.inspections[0].inspectionDate).toLocaleDateString() : "—"),
      sortValue: (f) => f.inspections?.[0]?.inspectionDate ?? "",
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("tailings.hint")}</p>

      <SummaryCards
        cards={[
          { label: t("tailings.summaryPoorRating"), value: poorRatingCount, tone: poorRatingCount > 0 ? "danger" : "default" },
          { label: t("tailings.summarySeepage"), value: seepageCount, tone: seepageCount > 0 ? "hazard" : "default" },
        ]}
      />

      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal("create")}>{t("tailings.newFacility")}</button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={facilities}
        rowKey={(f) => f.id}
        emptyMessage={t("tailings.noneYet")}
        searchValue={(f) => `${f.name} ${f.site?.name ?? ""}`}
        exportFilename="tailings-facilities"
        exportColumns={[
          { header: t("tailings.facilityName"), value: (f) => f.name },
          { header: t("common.site"), value: (f) => f.site?.name ?? "" },
          { header: t("tailings.lastRating"), value: (f) => f.inspections?.[0]?.structuralRating ?? "" },
          { header: t("tailings.lastInspection"), value: (f) => f.inspections?.[0]?.inspectionDate ?? "" },
        ]}
        actions={(f) => (
          <div className="flex justify-end gap-2">
            <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setInspectionsFacility(f)}>{t("tailings.inspections")}</button>
            {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setModal(f)}>{t("common.edit")}</button>}
            {canDelete && <button className={buttonDanger} onClick={() => remove(f.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />

      {modal && (
        <Modal title={modal === "create" ? t("tailings.newFacilityTitle") : t("tailings.editFacilityTitle")} onClose={() => setModal(null)}>
          <FacilityForm
            sites={sites}
            initial={modal === "create" ? undefined : modal}
            onSubmit={(data) => (modal === "create" ? create(data) : update(modal.id, data))}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {inspectionsFacility && (
        <InspectionsModal facility={inspectionsFacility} onClose={() => setInspectionsFacility(null)} onChanged={load} />
      )}
    </div>
  );
}
