import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  PressureEquipment,
  PressureEquipmentStatus,
  PressureEquipmentType,
  PressureInspectionType,
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

const equipmentTypes: PressureEquipmentType[] = ["AIR_RECEIVER", "BOILER", "PRESSURE_VESSEL", "AUTOCLAVE", "ACCUMULATOR", "STEAM_PIPING", "OTHER"];
const statuses: PressureEquipmentStatus[] = ["IN_SERVICE", "AWAITING_INSPECTION", "OUT_OF_SERVICE", "DECOMMISSIONED"];
const inspectionTypes: PressureInspectionType[] = ["EXTERNAL", "INTERNAL", "HYDROSTATIC", "SAFETY_VALVE", "ULTRASONIC_THICKNESS"];

function EquipmentForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: PressureEquipment;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [identifier, setIdentifier] = useState(initial?.identifier ?? "");
  const [equipmentType, setEquipmentType] = useState<PressureEquipmentType>(initial?.equipmentType ?? "AIR_RECEIVER");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [designPressureKpa, setDesignPressureKpa] = useState(initial?.designPressureKpa?.toString() ?? "");
  const [operatingPressureKpa, setOperatingPressureKpa] = useState(initial?.operatingPressureKpa?.toString() ?? "");
  const [capacityLitres, setCapacityLitres] = useState(initial?.capacityLitres?.toString() ?? "");
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? "");
  const [yearBuilt, setYearBuilt] = useState(initial?.yearBuilt?.toString() ?? "");
  const [inspectionAuthority, setInspectionAuthority] = useState(initial?.inspectionAuthority ?? "");
  const [certificateNumber, setCertificateNumber] = useState(initial?.certificateNumber ?? "");
  const [certificateExpiry, setCertificateExpiry] = useState(initial?.certificateExpiry?.slice(0, 10) ?? "");
  const [lastInspectionDate, setLastInspectionDate] = useState(initial?.lastInspectionDate?.slice(0, 10) ?? "");
  const [nextInspectionDue, setNextInspectionDue] = useState(initial?.nextInspectionDue?.slice(0, 10) ?? "");
  const [safetyValveLastTested, setSafetyValveLastTested] = useState(initial?.safetyValveLastTested?.slice(0, 10) ?? "");
  const [safetyValveNextDue, setSafetyValveNextDue] = useState(initial?.safetyValveNextDue?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<PressureEquipmentStatus>(initial?.status ?? "IN_SERVICE");
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
        location: location || undefined,
        designPressureKpa: designPressureKpa ? Number(designPressureKpa) : null,
        operatingPressureKpa: operatingPressureKpa ? Number(operatingPressureKpa) : null,
        capacityLitres: capacityLitres ? Number(capacityLitres) : null,
        manufacturer: manufacturer || undefined,
        serialNumber: serialNumber || undefined,
        yearBuilt: yearBuilt ? Number(yearBuilt) : null,
        inspectionAuthority: inspectionAuthority || undefined,
        certificateNumber: certificateNumber || undefined,
        certificateExpiry: certificateExpiry || null,
        lastInspectionDate: lastInspectionDate || null,
        nextInspectionDue: nextInspectionDue || null,
        safetyValveLastTested: safetyValveLastTested || null,
        safetyValveNextDue: safetyValveNextDue || null,
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
          <label className={labelClass}>{t("plantIntegrity.pressure.identifier")}</label>
          <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("common.type")}</label>
          <select className={selectClass} value={equipmentType} onChange={(e) => setEquipmentType(e.target.value as PressureEquipmentType)}>
            {equipmentTypes.map((v) => <option key={v} value={v}>{t(`plantIntegrity.pressure.types.${v}`)}</option>)}
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
          <label className={labelClass}>{t("plantIntegrity.location")}</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.description")}</label>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.pressure.designPressureKpa")}</label>
          <input className={inputClass} type="number" min={0} step="1" value={designPressureKpa} onChange={(e) => setDesignPressureKpa(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.pressure.operatingPressureKpa")}</label>
          <input className={inputClass} type="number" min={0} step="1" value={operatingPressureKpa} onChange={(e) => setOperatingPressureKpa(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.pressure.capacityLitres")}</label>
          <input className={inputClass} type="number" min={0} step="1" value={capacityLitres} onChange={(e) => setCapacityLitres(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.manufacturer")}</label>
          <input className={inputClass} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.serialNumber")}</label>
          <input className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.pressure.yearBuilt")}</label>
          <input className={inputClass} type="number" min={1800} max={2200} value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.pressure.inspectionAuthority")}</label>
          <input className={inputClass} value={inspectionAuthority} onChange={(e) => setInspectionAuthority(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.certificateNumber")}</label>
          <input className={inputClass} value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.pressure.certificateExpiry")}</label>
          <DateField value={certificateExpiry} onChange={setCertificateExpiry} />
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
          <label className={labelClass}>{t("plantIntegrity.pressure.safetyValveLastTested")}</label>
          <DateField value={safetyValveLastTested} onChange={setSafetyValveLastTested} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.pressure.safetyValveNextDue")}</label>
          <DateField value={safetyValveNextDue} onChange={setSafetyValveNextDue} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as PressureEquipmentStatus)}>
          {statuses.map((s) => <option key={s} value={s}>{t(`plantIntegrity.pressure.statuses.${s}`)}</option>)}
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

function InspectionForm({ item, onSubmit, onCancel }: {
  item: PressureEquipment;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [inspectionType, setInspectionType] = useState<PressureInspectionType>("EXTERNAL");
  const [inspectorName, setInspectorName] = useState("");
  const [inspectionAuthority, setInspectionAuthority] = useState(item.inspectionAuthority ?? "");
  const [passed, setPassed] = useState(true);
  const [findings, setFindings] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [certificateExpiry, setCertificateExpiry] = useState("");
  const [nextInspectionDue, setNextInspectionDue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const isValveTest = inspectionType === "SAFETY_VALVE";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        inspectionDate,
        inspectionType,
        inspectorName,
        inspectionAuthority: inspectionAuthority || undefined,
        passed,
        findings: findings || undefined,
        certificateNumber: certificateNumber || undefined,
        certificateExpiry: certificateExpiry || null,
        nextInspectionDue: nextInspectionDue || null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("plantIntegrity.pressure.inspectionHint", { identifier: item.identifier })}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.inspectionDate")}</label>
          <DateField value={inspectionDate} onChange={setInspectionDate} />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.inspectionType")}</label>
          <select className={selectClass} value={inspectionType} onChange={(e) => setInspectionType(e.target.value as PressureInspectionType)}>
            {inspectionTypes.map((v) => <option key={v} value={v}>{t(`plantIntegrity.pressure.inspectionTypes.${v}`)}</option>)}
          </select>
        </div>
      </div>
      {isValveTest && <p className="text-xs text-mine-400">{t("plantIntegrity.pressure.valveTestHint")}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("plantIntegrity.inspectorName")}</label>
          <input className={inputClass} value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("plantIntegrity.pressure.inspectionAuthority")}</label>
          <input className={inputClass} value={inspectionAuthority} onChange={(e) => setInspectionAuthority(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-mine-200">
        <input type="checkbox" checked={passed} onChange={(e) => setPassed(e.target.checked)} />
        {t("plantIntegrity.pressure.passed")}
      </label>
      {!passed && <p className="text-xs text-hazard-500">{t("plantIntegrity.pressure.failWarning")}</p>}
      <div>
        <label className={labelClass}>{t("plantIntegrity.findings")}</label>
        <textarea className={inputClass} rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
      </div>
      {!isValveTest && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t("plantIntegrity.certificateNumber")}</label>
            <input className={inputClass} value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("plantIntegrity.pressure.certificateExpiry")}</label>
            <DateField value={certificateExpiry} onChange={setCertificateExpiry} />
          </div>
        </div>
      )}
      <div>
        <label className={labelClass}>{isValveTest ? t("plantIntegrity.pressure.safetyValveNextDue") : t("plantIntegrity.nextInspectionDue")}</label>
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

export default function PressureRegisterTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [items, setItems] = useState<PressureEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | PressureEquipment>(null);
  const [inspectModal, setInspectModal] = useState<PressureEquipment | null>(null);
  const [historyFor, setHistoryFor] = useState<PressureEquipment | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<PressureEquipment[]>("/pressure-equipment");
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
    const live = items.filter((i) => i.status === "IN_SERVICE");
    // Certificate lapse and inspection lapse are counted separately on purpose:
    // a vessel inside its inspection interval can still be running on an expired
    // AIA certificate, and only one of those two is visible on the vessel itself.
    const certLapsed = live.filter((i) => isOverdue(i.certificateExpiry) || !i.certificateExpiry).length;
    const inspectionOverdue = live.filter((i) => isOverdue(i.nextInspectionDue) || !i.nextInspectionDue).length;
    const valveOverdue = live.filter((i) => isOverdue(i.safetyValveNextDue)).length;
    return {
      live: live.length,
      certLapsed,
      inspectionOverdue,
      valveOverdue,
      certifiedPct: live.length > 0 ? ((live.length - certLapsed) / live.length) * 100 : null,
    };
  }, [items]);

  async function create(data: any) {
    await api.post("/pressure-equipment", data);
    setFormModal(null);
    await load();
  }
  async function update(id: string, data: any) {
    await api.put(`/pressure-equipment/${id}`, data);
    setFormModal(null);
    await load();
  }
  async function remove(id: string) {
    if (!confirm(t("plantIntegrity.pressure.confirmDelete"))) return;
    await api.delete(`/pressure-equipment/${id}`);
    await load();
  }
  async function logInspection(id: string, data: any) {
    await api.post(`/pressure-equipment/${id}/inspections`, data);
    setInspectModal(null);
    await load();
  }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<PressureEquipment>[] = [
    { key: "identifier", header: t("plantIntegrity.pressure.identifier"), render: (i) => i.identifier, sortValue: (i) => i.identifier },
    { key: "equipmentType", header: t("common.type"), render: (i) => t(`plantIntegrity.pressure.types.${i.equipmentType}`), sortValue: (i) => i.equipmentType },
    { key: "site", header: t("common.site"), render: (i) => i.site?.name ?? "—", sortValue: (i) => i.site?.name ?? "" },
    {
      key: "designPressureKpa",
      header: t("plantIntegrity.pressure.designPressureShort"),
      render: (i) => (i.designPressureKpa != null ? `${i.designPressureKpa.toLocaleString()} kPa` : "—"),
      sortValue: (i) => i.designPressureKpa ?? -1,
    },
    { key: "inspectionAuthority", header: t("plantIntegrity.pressure.authorityShort"), render: (i) => i.inspectionAuthority || "—", sortValue: (i) => i.inspectionAuthority ?? "" },
    { key: "certificateExpiry", header: t("plantIntegrity.pressure.certificateExpiry"), render: (i) => <DueDate value={i.certificateExpiry} />, sortValue: (i) => i.certificateExpiry ?? "9999" },
    { key: "nextInspectionDue", header: t("plantIntegrity.nextInspectionDue"), render: (i) => <DueDate value={i.nextInspectionDue} />, sortValue: (i) => i.nextInspectionDue ?? "9999" },
    { key: "safetyValveNextDue", header: t("plantIntegrity.pressure.valveShort"), render: (i) => (i.safetyValveNextDue ? <DueDate value={i.safetyValveNextDue} /> : "—"), sortValue: (i) => i.safetyValveNextDue ?? "9999" },
    { key: "status", header: t("common.status"), render: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("plantIntegrity.pressure.statCertified")}
          value={stats.certifiedPct != null ? `${stats.certifiedPct.toFixed(0)}%` : "—"}
          target={t("plantIntegrity.targetHundred")}
          tone={stats.certifiedPct == null ? undefined : stats.certifiedPct >= 100 ? "good" : stats.certifiedPct >= 90 ? "warn" : "bad"}
        />
        <StatTile
          label={t("plantIntegrity.pressure.statCertLapsed")}
          value={stats.certLapsed}
          target={t("plantIntegrity.targetZero")}
          tone={stats.certLapsed === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("plantIntegrity.pressure.statInspectionOverdue")}
          value={stats.inspectionOverdue}
          target={t("plantIntegrity.targetZero")}
          tone={stats.inspectionOverdue === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("plantIntegrity.pressure.statValveOverdue")}
          value={stats.valveOverdue}
          target={t("plantIntegrity.targetZero")}
          tone={stats.valveOverdue === 0 ? "good" : "warn"}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("plantIntegrity.pressure.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("plantIntegrity.pressure.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("plantIntegrity.pressure.newItem")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(i) => i.id}
          emptyMessage={t("plantIntegrity.pressure.noneYet")}
          searchValue={(i) => `${i.identifier} ${i.description ?? ""} ${i.serialNumber ?? ""} ${i.location ?? ""} ${i.certificateNumber ?? ""}`}
          exportFilename="pressure-equipment-register"
          exportColumns={[
            { header: t("plantIntegrity.pressure.identifier"), value: (i) => i.identifier },
            { header: t("common.type"), value: (i) => i.equipmentType },
            { header: t("common.site"), value: (i) => i.site?.name ?? "" },
            { header: t("plantIntegrity.pressure.designPressureShort"), value: (i) => (i.designPressureKpa != null ? String(i.designPressureKpa) : "") },
            { header: t("plantIntegrity.pressure.inspectionAuthority"), value: (i) => i.inspectionAuthority ?? "" },
            { header: t("plantIntegrity.certificateNumber"), value: (i) => i.certificateNumber ?? "" },
            { header: t("plantIntegrity.pressure.certificateExpiry"), value: (i) => i.certificateExpiry?.slice(0, 10) ?? "" },
            { header: t("plantIntegrity.nextInspectionDue"), value: (i) => i.nextInspectionDue?.slice(0, 10) ?? "" },
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
        <Modal title={formModal === "create" ? t("plantIntegrity.pressure.newItemTitle") : t("plantIntegrity.pressure.editItemTitle")} onClose={() => setFormModal(null)}>
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
                    <span className="text-sm text-mine-100">{t(`plantIntegrity.pressure.inspectionTypes.${ins.inspectionType}`)}</span>
                    <StatusBadge status={ins.passed ? "PASS" : "FAIL"} />
                  </div>
                  <p className="text-xs text-mine-400">
                    {new Date(ins.inspectionDate).toLocaleDateString()} · {ins.inspectorName}
                    {ins.inspectionAuthority ? ` · ${ins.inspectionAuthority}` : ""}
                    {ins.certificateNumber ? ` · ${ins.certificateNumber}` : ""}
                  </p>
                  {ins.findings && <p className="text-xs text-hazard-500 mt-1">{ins.findings}</p>}
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
