import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  LiftingEquipment,
  LiftingEquipmentStatus,
  LiftingEquipmentType,
  LiftingInspectionResult,
  LiftingInspectionType,
  Site,
} from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import DueDate, { isOverdue } from "./DueDate";
import StatTile from "./StatTile";

const equipmentTypes: LiftingEquipmentType[] = [
  "OVERHEAD_CRANE",
  "MOBILE_CRANE",
  "GANTRY",
  "CHAIN_BLOCK",
  "LEVER_HOIST",
  "WINCH",
  "WIRE_ROPE_SLING",
  "CHAIN_SLING",
  "WEBBING_SLING",
  "SHACKLE",
  "EYEBOLT",
  "SPREADER_BEAM",
  "LIFTING_MAGNET",
  "OTHER",
];
const statuses: LiftingEquipmentStatus[] = ["IN_SERVICE", "QUARANTINED", "UNDER_REPAIR", "CONDEMNED"];
const inspectionTypes: LiftingInspectionType[] = ["VISUAL", "THOROUGH_EXAMINATION", "LOAD_TEST"];
const results: LiftingInspectionResult[] = ["PASS", "PASS_WITH_DEFECTS", "FAIL"];

function EquipmentForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: LiftingEquipment;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [identifier, setIdentifier] = useState(initial?.identifier ?? "");
  const [equipmentType, setEquipmentType] = useState<LiftingEquipmentType>(initial?.equipmentType ?? "CHAIN_BLOCK");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [safeWorkingLoadKg, setSafeWorkingLoadKg] = useState(initial?.safeWorkingLoadKg?.toString() ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? "");
  const [colourCode, setColourCode] = useState(initial?.colourCode ?? "");
  const [lastInspectionDate, setLastInspectionDate] = useState(initial?.lastInspectionDate?.slice(0, 10) ?? "");
  const [nextInspectionDue, setNextInspectionDue] = useState(initial?.nextInspectionDue?.slice(0, 10) ?? "");
  const [lastLoadTestDate, setLastLoadTestDate] = useState(initial?.lastLoadTestDate?.slice(0, 10) ?? "");
  const [nextLoadTestDue, setNextLoadTestDue] = useState(initial?.nextLoadTestDue?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<LiftingEquipmentStatus>(initial?.status ?? "IN_SERVICE");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        identifier,
        equipmentType,
        description: description || undefined,
        safeWorkingLoadKg: safeWorkingLoadKg ? Number(safeWorkingLoadKg) : null,
        location: location || undefined,
        manufacturer: manufacturer || undefined,
        serialNumber: serialNumber || undefined,
        colourCode: colourCode || undefined,
        lastInspectionDate: lastInspectionDate || null,
        nextInspectionDue: nextInspectionDue || null,
        lastLoadTestDate: lastLoadTestDate || null,
        nextLoadTestDue: nextLoadTestDue || null,
        status,
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
          <label className={labelClass}>{t("plantIntegrity.lifting.identifier")}</label>
          <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.lifting.equipmentType")}</label>
          <select className={selectClass} value={equipmentType} onChange={(e) => setEquipmentType(e.target.value as LiftingEquipmentType)}>
            {equipmentTypes.map((v) => <option key={v} value={v}>{t(`plantIntegrity.lifting.types.${v}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.lifting.safeWorkingLoadKg")}</label>
          <input className={inputClass} type="number" min={0} step="0.1" value={safeWorkingLoadKg} onChange={(e) => setSafeWorkingLoadKg(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.location")}</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.manufacturer")}</label>
          <input className={inputClass} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.serialNumber")}</label>
          <input className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.lifting.colourCode")}</label>
          <input className={inputClass} value={colourCode} onChange={(e) => setColourCode(e.target.value)} placeholder={t("plantIntegrity.lifting.colourCodeHint")} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as LiftingEquipmentStatus)}>
            {statuses.map((s) => <option key={s} value={s}>{t(`plantIntegrity.lifting.statuses.${s}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.lastInspection")}</label>
          <DateField value={lastInspectionDate} onChange={setLastInspectionDate} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.nextInspectionDue")}</label>
          <DateField value={nextInspectionDue} onChange={setNextInspectionDue} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.lifting.lastLoadTest")}</label>
          <DateField value={lastLoadTestDate} onChange={setLastLoadTestDate} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.lifting.nextLoadTestDue")}</label>
          <DateField value={nextLoadTestDue} onChange={setNextLoadTestDue} />
        </div>
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

function InspectionForm({ item, onSubmit, onCancel }: {
  item: LiftingEquipment;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [inspectionType, setInspectionType] = useState<LiftingInspectionType>("VISUAL");
  const [inspectorName, setInspectorName] = useState("");
  const [result, setResult] = useState<LiftingInspectionResult>("PASS");
  const [defectsFound, setDefectsFound] = useState("");
  const [loadTestedKg, setLoadTestedKg] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [colourCodeApplied, setColourCodeApplied] = useState("");
  const [nextInspectionDue, setNextInspectionDue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        inspectionDate,
        inspectionType,
        inspectorName,
        result,
        defectsFound: defectsFound || undefined,
        loadTestedKg: loadTestedKg ? Number(loadTestedKg) : null,
        certificateNumber: certificateNumber || undefined,
        colourCodeApplied: colourCodeApplied || undefined,
        nextInspectionDue: nextInspectionDue || null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("plantIntegrity.lifting.inspectionHint", { identifier: item.identifier })}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.inspectionDate")}</label>
          <DateField value={inspectionDate} onChange={setInspectionDate} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.inspectionType")}</label>
          <select className={selectClass} value={inspectionType} onChange={(e) => setInspectionType(e.target.value as LiftingInspectionType)}>
            {inspectionTypes.map((v) => <option key={v} value={v}>{t(`plantIntegrity.lifting.inspectionTypes.${v}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.inspectorName")}</label>
          <input className={inputClass} value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.result")}</label>
          <select className={selectClass} value={result} onChange={(e) => setResult(e.target.value as LiftingInspectionResult)}>
            {results.map((v) => <option key={v} value={v}>{t(`plantIntegrity.lifting.results.${v}`)}</option>)}
          </select>
        </div>
      </div>
      {result === "FAIL" && (
        <p className="text-xs text-hazard-500">{t("plantIntegrity.lifting.failWarning")}</p>
      )}
      <div>
        <label className={labelClass}>{t("plantIntegrity.lifting.defectsFound")}</label>
        <textarea className={inputClass} rows={2} value={defectsFound} onChange={(e) => setDefectsFound(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {inspectionType === "LOAD_TEST" && (
          <div>
            <label className={labelClass}>{t("plantIntegrity.lifting.loadTestedKg")}</label>
            <input className={inputClass} type="number" min={0} step="0.1" value={loadTestedKg} onChange={(e) => setLoadTestedKg(e.target.value)} />
          </div>
        )}
        <div>
          <label className={labelClass}>{t("plantIntegrity.certificateNumber")}</label>
          <input className={inputClass} value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.lifting.colourCodeApplied")}</label>
          <input className={inputClass} value={colourCodeApplied} onChange={(e) => setColourCodeApplied(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("plantIntegrity.nextInspectionDue")}</label>
        <DateField value={nextInspectionDue} onChange={setNextInspectionDue} />
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

export default function LiftingRegisterTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<LiftingEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | LiftingEquipment>(null);
  const [inspectModal, setInspectModal] = useState<LiftingEquipment | null>(null);
  const [historyFor, setHistoryFor] = useState<LiftingEquipment | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<LiftingEquipment[]>("/lifting-equipment");
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

  const stats = useMemo(() => {
    const inService = items.filter((i) => i.status === "IN_SERVICE");
    // Only in-service items count as overdue: a quarantined sling is already off
    // the rack, so counting it again would inflate the number the engineer acts on.
    const overdue = inService.filter((i) => isOverdue(i.nextInspectionDue) || !i.nextInspectionDue).length;
    const loadTestOverdue = inService.filter((i) => isOverdue(i.nextLoadTestDue)).length;
    const noSwl = items.filter((i) => i.safeWorkingLoadKg == null).length;
    return {
      total: items.length,
      inService: inService.length,
      overdue,
      loadTestOverdue,
      noSwl,
      quarantined: items.filter((i) => i.status === "QUARANTINED" || i.status === "CONDEMNED").length,
      compliancePct: inService.length > 0 ? ((inService.length - overdue) / inService.length) * 100 : null,
    };
  }, [items]);

  async function create(data: any) {
    await api.post("/lifting-equipment", data);
    setFormModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/lifting-equipment/${id}`, data);
    setFormModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("plantIntegrity.lifting.confirmDelete"))) return;
    await api.delete(`/lifting-equipment/${id}`);
    await load();
  }
  async function logInspection(id: string, data: any) {
    await api.post(`/lifting-equipment/${id}/inspections`, data);
    setInspectModal(null);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<LiftingEquipment>[] = [
    { key: "identifier", header: t("plantIntegrity.lifting.identifier"), render: (i) => i.identifier, sortValue: (i) => i.identifier },
    { key: "equipmentType", header: t("common.type"), render: (i) => t(`plantIntegrity.lifting.types.${i.equipmentType}`), sortValue: (i) => i.equipmentType },
    { key: "site", header: t("common.site"), render: (i) => i.site?.name ?? "—", sortValue: (i) => i.site?.name ?? "" },
    {
      key: "swl",
      header: t("plantIntegrity.lifting.swlShort"),
      render: (i) => (i.safeWorkingLoadKg != null ? `${i.safeWorkingLoadKg.toLocaleString()} kg` : <span className="text-hazard-500">{t("plantIntegrity.notSet")}</span>),
      sortValue: (i) => i.safeWorkingLoadKg ?? -1,
    },
    { key: "colourCode", header: t("plantIntegrity.lifting.colourCode"), render: (i) => i.colourCode || "—", sortValue: (i) => i.colourCode ?? "" },
    { key: "nextInspectionDue", header: t("plantIntegrity.nextInspectionDue"), render: (i) => <DueDate value={i.nextInspectionDue} />, sortValue: (i) => i.nextInspectionDue ?? "9999" },
    { key: "nextLoadTestDue", header: t("plantIntegrity.lifting.nextLoadTestDue"), render: (i) => (i.nextLoadTestDue ? <DueDate value={i.nextLoadTestDue} /> : "—"), sortValue: (i) => i.nextLoadTestDue ?? "9999" },
    { key: "status", header: t("common.status"), render: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("plantIntegrity.lifting.statInDate")}
          value={stats.compliancePct != null ? `${stats.compliancePct.toFixed(0)}%` : "—"}
          target={t("plantIntegrity.targetHundred")}
          tone={stats.compliancePct == null ? undefined : stats.compliancePct >= 100 ? "good" : stats.compliancePct >= 90 ? "warn" : "bad"}
        />
        <StatTile
          label={t("plantIntegrity.lifting.statOverdue")}
          value={stats.overdue}
          target={t("plantIntegrity.targetZero")}
          tone={stats.overdue === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("plantIntegrity.lifting.statLoadTestOverdue")}
          value={stats.loadTestOverdue}
          target={t("plantIntegrity.targetZero")}
          tone={stats.loadTestOverdue === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("plantIntegrity.lifting.statNoSwl")}
          value={stats.noSwl}
          target={t("plantIntegrity.targetZero")}
          tone={stats.noSwl === 0 ? "good" : "warn"}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("plantIntegrity.lifting.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("plantIntegrity.lifting.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("plantIntegrity.lifting.newItem")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(i) => i.id}
          emptyMessage={t("plantIntegrity.lifting.noneYet")}
          searchValue={(i) => `${i.identifier} ${i.description ?? ""} ${i.serialNumber ?? ""} ${i.location ?? ""}`}
          exportFilename="lifting-equipment-register"
          exportColumns={[
            { header: t("plantIntegrity.lifting.identifier"), value: (i) => i.identifier },
            { header: t("common.type"), value: (i) => i.equipmentType },
            { header: t("common.site"), value: (i) => i.site?.name ?? "" },
            { header: t("plantIntegrity.lifting.swlShort"), value: (i) => (i.safeWorkingLoadKg != null ? String(i.safeWorkingLoadKg) : "") },
            { header: t("plantIntegrity.lifting.colourCode"), value: (i) => i.colourCode ?? "" },
            { header: t("plantIntegrity.nextInspectionDue"), value: (i) => i.nextInspectionDue?.slice(0, 10) ?? "" },
            { header: t("plantIntegrity.lifting.nextLoadTestDue"), value: (i) => i.nextLoadTestDue?.slice(0, 10) ?? "" },
            { header: t("common.status"), value: (i) => i.status },
          ]}
          actions={(i) => (
            <div className="flex justify-end gap-2">
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setHistoryFor(i)}>{t("plantIntegrity.history")}</button>
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setInspectModal(i)}>{t("plantIntegrity.logInspection")}</button>}
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(i)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(i.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {formModal && (
        <Modal title={formModal === "create" ? t("plantIntegrity.lifting.newItemTitle") : t("plantIntegrity.lifting.editItemTitle")} onClose={() => setFormModal(null)}>
          <EquipmentForm
            sites={sites}
            initial={formModal === "create" ? undefined : formModal}
            onSubmit={(data) => (formModal === "create" ? create(data) : update(formModal.id, data))}
            onCancel={() => setFormModal(null)}
          />
        </Modal>
      )}

      {inspectModal && (
        <Modal title={t("plantIntegrity.logInspection")} onClose={() => setInspectModal(null)}>
          <InspectionForm item={inspectModal} onSubmit={(data) => logInspection(inspectModal.id, data)} onCancel={() => setInspectModal(null)} />
        </Modal>
      )}

      {historyFor && (
        <Modal title={t("plantIntegrity.historyTitle", { identifier: historyFor.identifier })} onClose={() => setHistoryFor(null)}>
          {historyFor.inspections && historyFor.inspections.length > 0 ? (
            <ul className="space-y-3">
              {historyFor.inspections.map((ins) => (
                <li key={ins.id} className="border-b border-mine-800 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-mine-100">{t(`plantIntegrity.lifting.inspectionTypes.${ins.inspectionType}`)}</span>
                    <StatusBadge status={ins.result} />
                  </div>
                  <p className="text-xs text-mine-400">
                    {new Date(ins.inspectionDate).toLocaleDateString()} · {ins.inspectorName}
                    {ins.certificateNumber ? ` · ${ins.certificateNumber}` : ""}
                    {ins.loadTestedKg != null ? ` · ${ins.loadTestedKg.toLocaleString()} kg` : ""}
                  </p>
                  {ins.defectsFound && <p className="text-xs text-hazard-500 mt-1">{ins.defectsFound}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mine-400">{t("plantIntegrity.noHistory")}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
