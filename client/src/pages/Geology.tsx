import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { DrillHole, DrillHoleStatus, MineralType, ResourceClassification, ResourceEstimate, Site } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import { mineralTypes } from "../lib/minerals";
import DataTable, { DataTableColumn } from "../components/DataTable";
import { AuditHistoryButton } from "../components/AuditHistoryPanel";
import LoadError from "../components/LoadError";

const drillHoleStatuses: DrillHoleStatus[] = ["PLANNED", "DRILLING", "COMPLETED", "ABANDONED"];
const classifications: ResourceClassification[] = ["MEASURED", "INDICATED", "INFERRED", "PROVED_RESERVE", "PROBABLE_RESERVE"];

function DrillHoleForm({ sites, onSubmit, onCancel }: { sites: Site[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [holeId, setHoleId] = useState("");
  const [collarEasting, setCollarEasting] = useState("");
  const [collarNorthing, setCollarNorthing] = useState("");
  const [totalDepth, setTotalDepth] = useState("");
  const [status, setStatus] = useState<DrillHoleStatus>("PLANNED");
  const [drilledDate, setDrilledDate] = useState("");
  const [contractor, setContractor] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId, holeId, collarEasting: collarEasting ? Number(collarEasting) : null,
        collarNorthing: collarNorthing ? Number(collarNorthing) : null, totalDepth: totalDepth ? Number(totalDepth) : null,
        status, drilledDate: drilledDate || null, contractor: contractor || undefined,
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
          <label className={labelClass}>{t("geology.holeId")}</label>
          <input className={inputClass} value={holeId} onChange={(e) => setHoleId(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("geology.collarEasting")}</label>
          <input className={inputClass} type="number" step="any" value={collarEasting} onChange={(e) => setCollarEasting(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("geology.collarNorthing")}</label>
          <input className={inputClass} type="number" step="any" value={collarNorthing} onChange={(e) => setCollarNorthing(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("geology.totalDepth")}</label>
          <input className={inputClass} type="number" step="any" value={totalDepth} onChange={(e) => setTotalDepth(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as DrillHoleStatus)}>
            {drillHoleStatuses.map((s) => <option key={s} value={s}>{t(`geology.drillHoleStatuses.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("geology.drilledDate")}</label>
          <DateField value={drilledDate} onChange={setDrilledDate} />
        </div>
        <div>
          <label className={labelClass}>{t("geology.contractor")}</label>
          <input className={inputClass} value={contractor} onChange={(e) => setContractor(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function AssaysModal({ hole, onClose, onChanged }: { hole: DrillHole; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [fromDepth, setFromDepth] = useState("");
  const [toDepth, setToDepth] = useState("");
  const [mineralType, setMineralType] = useState<MineralType>(mineralTypes[0]);
  const [grade, setGrade] = useState("");
  const [gradeUnit, setGradeUnit] = useState("g/t");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/geology/drill-holes/${hole.id}/assays`, {
        fromDepth: Number(fromDepth), toDepth: Number(toDepth), mineralType,
        grade: grade ? Number(grade) : null, gradeUnit: gradeUnit || undefined,
      });
      setFromDepth("");
      setToDepth("");
      setGrade("");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("geology.assaysFor", { holeId: hole.holeId })} onClose={onClose}>
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3 border border-mine-800 rounded-md p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>{t("geology.fromDepth")}</label>
              <input className={inputClass} type="number" step="any" value={fromDepth} onChange={(e) => setFromDepth(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("geology.toDepth")}</label>
              <input className={inputClass} type="number" step="any" value={toDepth} onChange={(e) => setToDepth(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>{t("marketplace.mineralType")}</label>
              <select className={selectClass} value={mineralType} onChange={(e) => setMineralType(e.target.value as MineralType)}>
                {mineralTypes.map((mt) => <option key={mt} value={mt}>{t(`mineralTypes.${mt}`)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t("geology.grade")}</label>
              <input className={inputClass} type="number" step="any" value={grade} onChange={(e) => setGrade(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t("geology.gradeUnit")}</label>
              <input className={inputClass} value={gradeUnit} onChange={(e) => setGradeUnit(e.target.value)} />
            </div>
          </div>
          <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
        </form>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {(hole.assayIntervals ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5">
              <span>{a.fromDepth}–{a.toDepth}m</span>
              <span className="text-mine-300">{t(`mineralTypes.${a.mineralType}`)}</span>
              <span className="text-mine-400">{a.grade != null ? `${a.grade} ${a.gradeUnit ?? ""}` : "—"}</span>
            </div>
          ))}
          {(hole.assayIntervals ?? []).length === 0 && <div className="text-mine-400 text-sm">{t("geology.noAssays")}</div>}
        </div>
      </div>
    </Modal>
  );
}

function DrillHolesTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [holes, setHoles] = useState<DrillHole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);
  const [assaysHole, setAssaysHole] = useState<DrillHole | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<DrillHole[]>("/geology/drill-holes");
      setHoles(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/geology/drill-holes", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/geology/drill-holes/${id}`);
    await load();
  }

  async function refreshAssaysHole() {
    const res = await api.get<DrillHole[]>("/geology/drill-holes");
    setHoles(res.data);
    if (assaysHole) {
      const updated = res.data.find((h) => h.id === assaysHole.id);
      if (updated) setAssaysHole(updated);
    }
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("geology.newDrillHole")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "holeId", header: t("geology.holeId"), render: (h) => <span className="font-medium">{h.holeId}</span>, sortValue: (h) => h.holeId },
            { key: "site", header: t("common.site"), render: (h) => h.site?.name ?? "—", sortValue: (h) => h.site?.name ?? "" },
            { key: "depth", header: t("geology.totalDepth"), render: (h) => h.totalDepth ?? "—", sortValue: (h) => h.totalDepth ?? 0 },
            { key: "status", header: t("common.status"), render: (h) => <StatusBadge status={h.status} />, sortValue: (h) => h.status },
          ] as DataTableColumn<DrillHole>[]
        }
        rows={holes}
        rowKey={(h) => h.id}
        emptyMessage={t("geology.noDrillHoles")}
        searchValue={(h) => `${h.holeId} ${h.site?.name ?? ""}`}
        actions={(h) => (
          <div className="flex justify-end gap-2">
            <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setAssaysHole(h)}>{t("geology.assays")}</button>
            {canDelete && <button className={buttonDanger} onClick={() => remove(h.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={t("geology.newDrillHoleTitle")} onClose={() => setModal(false)}>
          <DrillHoleForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
      {assaysHole && <AssaysModal hole={assaysHole} onClose={() => setAssaysHole(null)} onChanged={refreshAssaysHole} />}
    </div>
  );
}

function EstimateForm({ sites, onSubmit, onCancel }: { sites: Site[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [estimateDate, setEstimateDate] = useState("");
  const [mineralType, setMineralType] = useState<MineralType>(mineralTypes[0]);
  const [classification, setClassification] = useState<ResourceClassification>("INDICATED");
  const [tonnage, setTonnage] = useState("");
  const [grade, setGrade] = useState("");
  const [gradeUnit, setGradeUnit] = useState("g/t");
  const [competentPerson, setCompetentPerson] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId, estimateDate, mineralType, classification, tonnage: Number(tonnage),
        grade: grade ? Number(grade) : null, gradeUnit: gradeUnit || undefined, competentPerson: competentPerson || undefined,
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
          <label className={labelClass}>{t("geology.estimateDate")}</label>
          <DateField value={estimateDate} onChange={setEstimateDate} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("marketplace.mineralType")}</label>
          <select className={selectClass} value={mineralType} onChange={(e) => setMineralType(e.target.value as MineralType)}>
            {mineralTypes.map((mt) => <option key={mt} value={mt}>{t(`mineralTypes.${mt}`)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("geology.classification")}</label>
          <select className={selectClass} value={classification} onChange={(e) => setClassification(e.target.value as ResourceClassification)}>
            {classifications.map((c) => <option key={c} value={c}>{t(`geology.classifications.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("geology.tonnage")}</label>
          <input className={inputClass} type="number" step="any" value={tonnage} onChange={(e) => setTonnage(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("geology.grade")}</label>
          <input className={inputClass} type="number" step="any" value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("geology.gradeUnit")}</label>
          <input className={inputClass} value={gradeUnit} onChange={(e) => setGradeUnit(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("geology.competentPerson")}</label>
        <input className={inputClass} value={competentPerson} onChange={(e) => setCompetentPerson(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function ResourceEstimatesTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [estimates, setEstimates] = useState<ResourceEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ResourceEstimate[]>("/geology/resource-estimates");
      setEstimates(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/geology/resource-estimates", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/geology/resource-estimates/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-mine-400">{t("geology.estimatesHint")}</p>
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("geology.newEstimate")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "date", header: t("geology.estimateDate"), render: (e) => new Date(e.estimateDate).toLocaleDateString(), sortValue: (e) => e.estimateDate },
            { key: "mineral", header: t("marketplace.mineralType"), render: (e) => t(`mineralTypes.${e.mineralType}`), sortValue: (e) => e.mineralType },
            { key: "classification", header: t("geology.classification"), render: (e) => t(`geology.classifications.${e.classification}`), sortValue: (e) => e.classification },
            { key: "tonnage", header: t("geology.tonnage"), render: (e) => e.tonnage.toLocaleString(), sortValue: (e) => e.tonnage },
            { key: "version", header: t("geology.version"), render: (e) => `v${e.version}`, sortValue: (e) => e.version },
          ] as DataTableColumn<ResourceEstimate>[]
        }
        rows={estimates}
        rowKey={(e) => e.id}
        emptyMessage={t("geology.noEstimates")}
        actions={(e) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="ResourceEstimate" entityId={e.id} />
            {canDelete && <button className={buttonDanger} onClick={() => remove(e.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={t("geology.newEstimateTitle")} onClose={() => setModal(false)}>
          <EstimateForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
    </div>
  );
}

export default function Geology() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"drillholes" | "estimates">("drillholes");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    api
      .get<Site[]>("/sites")
      .then((res) => setSites(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("geology.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("geology.subtitle")}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={tab === "drillholes" ? buttonPrimary : buttonSecondary} onClick={() => setTab("drillholes")}>{t("geology.tabDrillHoles")}</button>
        <button className={tab === "estimates" ? buttonPrimary : buttonSecondary} onClick={() => setTab("estimates")}>{t("geology.tabEstimates")}</button>
      </div>
      {tab === "drillholes" && <DrillHolesTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "estimates" && <ResourceEstimatesTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
