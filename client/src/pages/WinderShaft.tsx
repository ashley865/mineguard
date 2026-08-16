import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ShaftInspection, Site, Winder, WinderInspectionResult } from "../api/types";
import { StatusBadge } from "../components/Badges";
import Modal from "../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../components/ui";
import DateField from "../components/DateField";
import DataTable, { DataTableColumn } from "../components/DataTable";
import { AuditHistoryButton } from "../components/AuditHistoryPanel";
import LoadError from "../components/LoadError";

const brakeResults: WinderInspectionResult[] = ["PASS", "FAIL", "CONDITIONAL"];

function WinderForm({ sites, onSubmit, onCancel }: { sites: Site[]; onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [name, setName] = useState("");
  const [shaftName, setShaftName] = useState("");
  const [winderType, setWinderType] = useState("");
  const [installedDate, setInstalledDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ siteId, name, shaftName: shaftName || undefined, winderType: winderType || undefined, installedDate: installedDate || null });
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
          <label className={labelClass}>{t("winders.winderName")}</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("winders.shaftName")}</label>
          <input className={inputClass} value={shaftName} onChange={(e) => setShaftName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("winders.winderType")}</label>
          <input className={inputClass} value={winderType} onChange={(e) => setWinderType(e.target.value)} placeholder={t("winders.winderTypePlaceholder") ?? ""} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("groundControl.installedDate")}</label>
        <DateField value={installedDate} onChange={setInstalledDate} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={buttonSecondary} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  );
}

function WinderDetailModal({ winder, onClose, onChanged }: { winder: Winder; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspector, setInspector] = useState("");
  const [brakeTestResult, setBrakeTestResult] = useState<WinderInspectionResult>("PASS");
  const [findings, setFindings] = useState("");
  const [savingInspection, setSavingInspection] = useState(false);

  const [ropeIdentifier, setRopeIdentifier] = useState("");
  const [ropeInstalledDate, setRopeInstalledDate] = useState("");
  const [discardDate, setDiscardDate] = useState("");
  const [savingRope, setSavingRope] = useState(false);

  async function submitInspection(e: FormEvent) {
    e.preventDefault();
    setSavingInspection(true);
    try {
      await api.post(`/winders/${winder.id}/inspections`, { inspectionDate, inspector, brakeTestResult, findings: findings || undefined });
      setInspectionDate("");
      setInspector("");
      setFindings("");
      onChanged();
    } finally {
      setSavingInspection(false);
    }
  }

  async function submitRope(e: FormEvent) {
    e.preventDefault();
    setSavingRope(true);
    try {
      await api.post(`/winders/${winder.id}/ropes`, { ropeIdentifier, installedDate: ropeInstalledDate, discardDate: discardDate || null });
      setRopeIdentifier("");
      setRopeInstalledDate("");
      setDiscardDate("");
      onChanged();
    } finally {
      setSavingRope(false);
    }
  }

  return (
    <Modal title={t("winders.detailsFor", { name: winder.name })} onClose={onClose}>
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-mine-200 mb-2">{t("winders.inspections")}</h3>
          <form onSubmit={submitInspection} className="space-y-3 border border-mine-800 rounded-md p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("mineRescue.drillDate")}</label>
                <DateField value={inspectionDate} onChange={setInspectionDate} required />
              </div>
              <div>
                <label className={labelClass}>{t("tailings.inspector")}</label>
                <input className={inputClass} value={inspector} onChange={(e) => setInspector(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("winders.brakeTestResult")}</label>
              <select className={selectClass} value={brakeTestResult} onChange={(e) => setBrakeTestResult(e.target.value as WinderInspectionResult)}>
                {brakeResults.map((r) => <option key={r} value={r}>{t(`badges.status.${r}`)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("tailings.findings")}</label>
              <textarea className={inputClass} rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
            </div>
            <button type="submit" className={buttonPrimary} disabled={savingInspection}>{savingInspection ? t("common.saving") : t("common.save")}</button>
          </form>
          <div className="space-y-1 max-h-40 overflow-y-auto mt-2">
            {(winder.inspections ?? []).map((i) => (
              <div key={i.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5">
                <span>{new Date(i.inspectionDate).toLocaleDateString()} — {i.inspector}</span>
                {i.brakeTestResult && <StatusBadge status={i.brakeTestResult} />}
                <AuditHistoryButton entityType="WinderInspection" entityId={i.id} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-mine-200 mb-2">{t("winders.ropes")}</h3>
          <form onSubmit={submitRope} className="space-y-3 border border-mine-800 rounded-md p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>{t("winders.ropeIdentifier")}</label>
                <input className={inputClass} value={ropeIdentifier} onChange={(e) => setRopeIdentifier(e.target.value)} required />
              </div>
              <div>
                <label className={labelClass}>{t("common.startDate")}</label>
                <DateField value={ropeInstalledDate} onChange={setRopeInstalledDate} required />
              </div>
              <div>
                <label className={labelClass}>{t("winders.discardDate")}</label>
                <DateField value={discardDate} onChange={setDiscardDate} />
              </div>
            </div>
            <button type="submit" className={buttonPrimary} disabled={savingRope}>{savingRope ? t("common.saving") : t("common.save")}</button>
          </form>
          <div className="space-y-1 max-h-40 overflow-y-auto mt-2">
            {(winder.ropes ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs border-t border-mine-800 pt-1.5">
                <span>{r.ropeIdentifier}</span>
                <span className="text-mine-400">{r.discardDate ? new Date(r.discardDate).toLocaleDateString() : "—"}</span>
                <StatusBadge status={r.status} />
                <AuditHistoryButton entityType="ConveyanceRope" entityId={r.id} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function WindersTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [winders, setWinders] = useState<Winder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);
  const [detailWinder, setDetailWinder] = useState<Winder | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<Winder[]>("/winders");
      setWinders(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create(data: any) {
    await api.post("/winders", data);
    setModal(false);
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/winders/${id}`);
    await load();
  }

  async function refreshDetail() {
    const res = await api.get<Winder[]>("/winders");
    setWinders(res.data);
    if (detailWinder) {
      const updated = res.data.find((w) => w.id === detailWinder.id);
      if (updated) setDetailWinder(updated);
    }
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("winders.newWinder")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "name", header: t("winders.winderName"), render: (w) => <span className="font-medium">{w.name}</span>, sortValue: (w) => w.name },
            { key: "site", header: t("common.site"), render: (w) => w.site?.name ?? "—", sortValue: (w) => w.site?.name ?? "" },
            { key: "shaft", header: t("winders.shaftName"), render: (w) => w.shaftName ?? "—", sortValue: (w) => w.shaftName ?? "" },
            {
              key: "lastInspection",
              header: t("winders.lastInspection"),
              render: (w) => (w.inspections && w.inspections.length > 0 ? new Date(w.inspections[0].inspectionDate).toLocaleDateString() : "—"),
              sortValue: (w) => w.inspections?.[0]?.inspectionDate ?? "",
            },
          ] as DataTableColumn<Winder>[]
        }
        rows={winders}
        rowKey={(w) => w.id}
        emptyMessage={t("winders.noWinders")}
        searchValue={(w) => `${w.name} ${w.site?.name ?? ""} ${w.shaftName ?? ""}`}
        actions={(w) => (
          <div className="flex justify-end gap-2">
            <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setDetailWinder(w)}>{t("winders.details")}</button>
            {canDelete && <button className={buttonDanger} onClick={() => remove(w.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={t("winders.newWinderTitle")} onClose={() => setModal(false)}>
          <WinderForm sites={sites} onSubmit={create} onCancel={() => setModal(false)} />
        </Modal>
      )}
      {detailWinder && <WinderDetailModal winder={detailWinder} onClose={() => setDetailWinder(null)} onChanged={refreshDetail} />}
    </div>
  );
}

function ShaftInspectionsTab({ sites, canEdit, canDelete }: { sites: Site[]; canEdit: boolean; canDelete: boolean }) {
  const { t } = useTranslation();
  const [inspections, setInspections] = useState<ShaftInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [shaftName, setShaftName] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspector, setInspector] = useState("");
  const [headgearCondition, setHeadgearCondition] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<ShaftInspection[]>("/winders/shaft-inspections");
      setInspections(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/winders/shaft-inspections", { siteId, shaftName, inspectionDate, inspector, headgearCondition: headgearCondition || undefined });
      setModal(false);
      setShaftName("");
      setInspector("");
      setHeadgearCondition("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await api.delete(`/winders/shaft-inspections/${id}`);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-4">
      {canEdit && sites.length > 0 && (
        <div className="flex justify-end">
          <button className={buttonPrimary} onClick={() => setModal(true)}>{t("winders.newShaftInspection")}</button>
        </div>
      )}
      <DataTable
        columns={
          [
            { key: "shaft", header: t("winders.shaftName"), render: (i) => <span className="font-medium">{i.shaftName}</span>, sortValue: (i) => i.shaftName },
            { key: "site", header: t("common.site"), render: (i) => i.site?.name ?? "—", sortValue: (i) => i.site?.name ?? "" },
            { key: "date", header: t("tailings.inspectionDate"), render: (i) => new Date(i.inspectionDate).toLocaleDateString(), sortValue: (i) => i.inspectionDate },
            { key: "headgear", header: t("winders.headgearCondition"), render: (i) => i.headgearCondition ?? "—" },
          ] as DataTableColumn<ShaftInspection>[]
        }
        rows={inspections}
        rowKey={(i) => i.id}
        emptyMessage={t("winders.noShaftInspections")}
        searchValue={(i) => `${i.shaftName} ${i.site?.name ?? ""}`}
        actions={(i) => (
          <div className="flex justify-end gap-2">
            <AuditHistoryButton entityType="ShaftInspection" entityId={i.id} />
            {canDelete && <button className={buttonDanger} onClick={() => remove(i.id)}>{t("common.delete")}</button>}
          </div>
        )}
      />
      {modal && (
        <Modal title={t("winders.newShaftInspectionTitle")} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("common.site")}</label>
                <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("winders.shaftName")}</label>
                <input className={inputClass} value={shaftName} onChange={(e) => setShaftName(e.target.value)} required />
              </div>
            </div>
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
            <div>
              <label className={labelClass}>{t("winders.headgearCondition")}</label>
              <input className={inputClass} value={headgearCondition} onChange={(e) => setHeadgearCondition(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={buttonSecondary} onClick={() => setModal(false)}>{t("common.cancel")}</button>
              <button type="submit" className={buttonPrimary} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function WinderShaft() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [tab, setTab] = useState<"winders" | "shafts">("winders");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<Site[]>("/sites");
      setSites(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t("winders.nav")}</h1>
        <p className="text-mine-300 text-sm">{t("winders.subtitle")}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button className={tab === "winders" ? buttonPrimary : buttonSecondary} onClick={() => setTab("winders")}>{t("winders.tabWinders")}</button>
        <button className={tab === "shafts" ? buttonPrimary : buttonSecondary} onClick={() => setTab("shafts")}>{t("winders.tabShafts")}</button>
      </div>
      {tab === "winders" && <WindersTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
      {tab === "shafts" && <ShaftInspectionsTab sites={sites} canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}
