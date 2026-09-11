import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { CalibrationType, GasDetectionInstrument, GasInstrumentStatus, GasInstrumentType, Site } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import DueDate, { isOverdue } from "./DueDate";
import StatTile from "../plant/StatTile";

const instrumentTypes: GasInstrumentType[] = [
  "PORTABLE_MULTI_GAS",
  "METHANOMETER",
  "CO_DETECTOR",
  "OXYGEN_METER",
  "FLAME_SAFETY_LAMP",
  "ANEMOMETER",
  "DUST_PUMP",
  "OTHER",
];
const statuses: GasInstrumentStatus[] = ["IN_SERVICE", "OUT_OF_CALIBRATION", "UNDER_REPAIR", "WITHDRAWN"];
const calibrationTypes: CalibrationType[] = ["FULL_CALIBRATION", "BUMP_TEST", "ZERO_CHECK", "SPAN_CHECK"];

function InstrumentForm({ sites, initial, onSubmit, onCancel }: {
  sites: Site[];
  initial?: GasDetectionInstrument;
  onSubmit: (d: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [identifier, setIdentifier] = useState(initial?.identifier ?? "");
  const [instrumentType, setInstrumentType] = useState<GasInstrumentType>(initial?.instrumentType ?? "PORTABLE_MULTI_GAS");
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [nextCalibrationDue, setNextCalibrationDue] = useState(initial?.nextCalibrationDue?.slice(0, 10) ?? "");
  const [nextBumpTestDue, setNextBumpTestDue] = useState(initial?.nextBumpTestDue?.slice(0, 10) ?? "");
  const [status, setStatus] = useState<GasInstrumentStatus>(initial?.status ?? "IN_SERVICE");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        identifier,
        instrumentType,
        manufacturer: manufacturer || undefined,
        serialNumber: serialNumber || undefined,
        assignedTo: assignedTo || undefined,
        nextCalibrationDue: nextCalibrationDue || null,
        nextBumpTestDue: nextBumpTestDue || null,
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
          <label className={labelClass}>{t("ventilationRegisters.instruments.identifier")}</label>
          <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.instruments.instrumentType")}</label>
          <select className={selectClass} value={instrumentType} onChange={(e) => setInstrumentType(e.target.value as GasInstrumentType)}>
            {instrumentTypes.map((v) => <option key={v} value={v}>{t(`ventilationRegisters.instruments.types.${v}`)}</option>)}
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
          <label className={labelClass}>{t("ventilationRegisters.instruments.assignedTo")}</label>
          <input className={inputClass} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.manufacturer")}</label>
          <input className={inputClass} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.serialNumber")}</label>
          <input className={inputClass} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.instruments.nextCalibrationDue")}</label>
          <DateField value={nextCalibrationDue} onChange={setNextCalibrationDue} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.instruments.nextBumpTestDue")}</label>
          <DateField value={nextBumpTestDue} onChange={setNextBumpTestDue} />
        </div>
      </div>
      <p className="text-[11px] text-mine-400">{t("ventilationRegisters.instruments.intervalHint")}</p>
      <div>
        <label className={labelClass}>{t("common.status")}</label>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as GasInstrumentStatus)}>
          {statuses.map((s) => <option key={s} value={s}>{t(`ventilationRegisters.instruments.statuses.${s}`)}</option>)}
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

function CalibrationForm({ instrument, onSubmit, onCancel }: {
  instrument: GasDetectionInstrument;
  onSubmit: (d: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [calibrationDate, setCalibrationDate] = useState(new Date().toISOString().slice(0, 10));
  const [calibrationType, setCalibrationType] = useState<CalibrationType>("BUMP_TEST");
  const [performedByName, setPerformedByName] = useState("");
  const [gasStandardUsed, setGasStandardUsed] = useState("");
  const [result, setResult] = useState<"PASS" | "ADJUSTED" | "FAIL">("PASS");
  const [findings, setFindings] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        calibrationDate,
        calibrationType,
        performedByName,
        gasStandardUsed: gasStandardUsed || undefined,
        result,
        findings: findings || undefined,
        nextDue: nextDue || null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("ventilationRegisters.instruments.calibrationHint", { identifier: instrument.identifier })}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.instruments.calibrationDate")}</label>
          <DateField value={calibrationDate} onChange={setCalibrationDate} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.instruments.calibrationType")}</label>
          <select className={selectClass} value={calibrationType} onChange={(e) => setCalibrationType(e.target.value as CalibrationType)}>
            {calibrationTypes.map((v) => <option key={v} value={v}>{t(`ventilationRegisters.instruments.calibrationTypes.${v}`)}</option>)}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-mine-400">
        {calibrationType === "BUMP_TEST"
          ? t("ventilationRegisters.instruments.bumpRollsHint")
          : t("ventilationRegisters.instruments.calibrationRollsHint")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.instruments.performedBy")}</label>
          <input className={inputClass} value={performedByName} onChange={(e) => setPerformedByName(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.instruments.gasStandardUsed")}</label>
          <input className={inputClass} value={gasStandardUsed} onChange={(e) => setGasStandardUsed(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("ventilationRegisters.result")}</label>
        <select className={selectClass} value={result} onChange={(e) => setResult(e.target.value as "PASS" | "ADJUSTED" | "FAIL")}>
          <option value="PASS">{t("ventilationRegisters.instruments.results.PASS")}</option>
          <option value="ADJUSTED">{t("ventilationRegisters.instruments.results.ADJUSTED")}</option>
          <option value="FAIL">{t("ventilationRegisters.instruments.results.FAIL")}</option>
        </select>
      </div>
      {result === "FAIL" && <p className="text-xs text-danger-500">{t("ventilationRegisters.instruments.failWarning")}</p>}
      <div>
        <label className={labelClass}>{t("ventilationRegisters.findings")}</label>
        <textarea className={inputClass} rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("ventilationRegisters.instruments.nextDue")}</label>
        <DateField value={nextDue} onChange={setNextDue} />
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

export default function GasInstrumentsTab({ sites }: { sites: Site[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [instruments, setInstruments] = useState<GasDetectionInstrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | GasDetectionInstrument>(null);
  const [calModal, setCalModal] = useState<GasDetectionInstrument | null>(null);
  const [historyFor, setHistoryFor] = useState<GasDetectionInstrument | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<GasDetectionInstrument[]>("/gas-instruments");
      setInstruments(res.data);
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
    const live = instruments.filter((i) => i.status === "IN_SERVICE");
    const calibrationOverdue = live.filter((i) => isOverdue(i.nextCalibrationDue) || !i.nextCalibrationDue).length;
    const bumpOverdue = live.filter((i) => isOverdue(i.nextBumpTestDue) || !i.nextBumpTestDue).length;
    const outOfCalibration = instruments.filter((i) => i.status === "OUT_OF_CALIBRATION").length;
    return { live: live.length, calibrationOverdue, bumpOverdue, outOfCalibration };
  }, [instruments]);

  async function create(d: any) { await api.post("/gas-instruments", d); setFormModal(null); await load(); }
  async function update(id: string, d: any) { await api.put(`/gas-instruments/${id}`, d); setFormModal(null); await load(); }
  async function remove(id: string) {
    if (!confirm(t("ventilationRegisters.instruments.confirmDelete"))) return;
    await api.delete(`/gas-instruments/${id}`);
    await load();
  }
  async function logCalibration(id: string, d: any) { await api.post(`/gas-instruments/${id}/calibrations`, d); setCalModal(null); await load(); }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<GasDetectionInstrument>[] = [
    { key: "identifier", header: t("ventilationRegisters.instruments.identifier"), render: (i) => i.identifier, sortValue: (i) => i.identifier },
    { key: "instrumentType", header: t("common.type"), render: (i) => t(`ventilationRegisters.instruments.types.${i.instrumentType}`), sortValue: (i) => i.instrumentType },
    { key: "site", header: t("common.site"), render: (i) => i.site?.name ?? "—", sortValue: (i) => i.site?.name ?? "" },
    { key: "assignedTo", header: t("ventilationRegisters.instruments.assignedTo"), render: (i) => i.assignedTo || "—", sortValue: (i) => i.assignedTo ?? "" },
    { key: "nextBumpTestDue", header: t("ventilationRegisters.instruments.bumpShort"), render: (i) => <DueDate value={i.nextBumpTestDue} withinDays={7} />, sortValue: (i) => i.nextBumpTestDue ?? "9999" },
    { key: "nextCalibrationDue", header: t("ventilationRegisters.instruments.calibrationShort"), render: (i) => <DueDate value={i.nextCalibrationDue} />, sortValue: (i) => i.nextCalibrationDue ?? "9999" },
    { key: "status", header: t("common.status"), render: (i) => <StatusBadge status={i.status} />, sortValue: (i) => i.status },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("ventilationRegisters.instruments.statOutOfCalibration")}
          value={stats.outOfCalibration}
          target={t("ventilationRegisters.targetZero")}
          tone={stats.outOfCalibration === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("ventilationRegisters.instruments.statCalibrationOverdue")}
          value={stats.calibrationOverdue}
          target={t("ventilationRegisters.targetZero")}
          tone={stats.calibrationOverdue === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("ventilationRegisters.instruments.statBumpOverdue")}
          value={stats.bumpOverdue}
          target={t("ventilationRegisters.targetZero")}
          tone={stats.bumpOverdue === 0 ? "good" : "warn"}
        />
        <StatTile label={t("ventilationRegisters.instruments.statLive")} value={stats.live} target={t("ventilationRegisters.instruments.statLiveTarget")} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("ventilationRegisters.instruments.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("ventilationRegisters.instruments.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("ventilationRegisters.instruments.newInstrument")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={instruments}
          rowKey={(i) => i.id}
          emptyMessage={t("ventilationRegisters.instruments.noneYet")}
          searchValue={(i) => `${i.identifier} ${i.serialNumber ?? ""} ${i.assignedTo ?? ""}`}
          exportFilename="gas-detection-instruments"
          exportColumns={[
            { header: t("ventilationRegisters.instruments.identifier"), value: (i) => i.identifier },
            { header: t("common.type"), value: (i) => i.instrumentType },
            { header: t("ventilationRegisters.instruments.nextCalibrationDue"), value: (i) => i.nextCalibrationDue?.slice(0, 10) ?? "" },
            { header: t("common.status"), value: (i) => i.status },
          ]}
          actions={(i) => (
            <div className="flex justify-end gap-2">
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setHistoryFor(i)}>{t("ventilationRegisters.history")}</button>
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setCalModal(i)}>{t("ventilationRegisters.instruments.logCalibration")}</button>}
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(i)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(i.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {formModal && (
        <Modal title={formModal === "create" ? t("ventilationRegisters.instruments.newInstrumentTitle") : t("ventilationRegisters.instruments.editInstrumentTitle")} onClose={() => setFormModal(null)}>
          <InstrumentForm
            sites={sites}
            initial={formModal === "create" ? undefined : formModal}
            onSubmit={(d) => (formModal === "create" ? create(d) : update(formModal.id, d))}
            onCancel={() => setFormModal(null)}
          />
        </Modal>
      )}

      {calModal && (
        <Modal title={t("ventilationRegisters.instruments.logCalibration")} onClose={() => setCalModal(null)}>
          <CalibrationForm instrument={calModal} onSubmit={(d) => logCalibration(calModal.id, d)} onCancel={() => setCalModal(null)} />
        </Modal>
      )}

      {historyFor && (
        <Modal title={t("ventilationRegisters.historyTitle", { identifier: historyFor.identifier })} onClose={() => setHistoryFor(null)}>
          {historyFor.calibrations && historyFor.calibrations.length > 0 ? (
            <ul className="space-y-3">
              {historyFor.calibrations.map((c) => (
                <li key={c.id} className="border-b border-mine-800 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-mine-100">{t(`ventilationRegisters.instruments.calibrationTypes.${c.calibrationType}`)}</span>
                    <StatusBadge status={c.result} />
                  </div>
                  <p className="text-xs text-mine-400">
                    {new Date(c.calibrationDate).toLocaleDateString()} · {c.performedByName}
                    {c.gasStandardUsed ? ` · ${c.gasStandardUsed}` : ""}
                  </p>
                  {c.findings && <p className="text-xs text-hazard-500 mt-1">{c.findings}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mine-400">{t("ventilationRegisters.instruments.noCalibrationsYet")}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
