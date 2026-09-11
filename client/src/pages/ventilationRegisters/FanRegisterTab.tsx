import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { FanStatus, FanStoppageReason, FanType, Site, VentilationFan, Zone } from "../../api/types";
import { StatusBadge } from "../../components/Badges";
import Modal from "../../components/Modal";
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass, labelClass, selectClass } from "../../components/ui";
import DateField from "../../components/DateField";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import LoadError from "../../components/LoadError";
import DueDate, { isOverdue } from "./DueDate";
import StatTile from "../plant/StatTile";

const fanTypes: FanType[] = ["MAIN_SURFACE", "MAIN_UNDERGROUND", "BOOSTER", "AUXILIARY", "FORCE", "EXHAUST", "OTHER"];
const fanStatuses: FanStatus[] = ["RUNNING", "STOPPED", "STANDBY", "UNDER_REPAIR", "DECOMMISSIONED"];
const stoppageReasons: FanStoppageReason[] = ["PLANNED_MAINTENANCE", "BREAKDOWN", "POWER_FAILURE", "EMERGENCY", "OTHER"];

function FanForm({ sites, zones, initial, onSubmit, onCancel }: {
  sites: Site[];
  zones: Zone[];
  initial?: VentilationFan;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [identifier, setIdentifier] = useState(initial?.identifier ?? "");
  const [fanType, setFanType] = useState<FanType>(initial?.fanType ?? "AUXILIARY");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? "");
  const [dutyQuantityM3s, setDutyQuantityM3s] = useState(initial?.dutyQuantityM3s?.toString() ?? "");
  const [dutyPressurePa, setDutyPressurePa] = useState(initial?.dutyPressurePa?.toString() ?? "");
  const [motorKw, setMotorKw] = useState(initial?.motorKw?.toString() ?? "");
  const [installedDate, setInstalledDate] = useState(initial?.installedDate?.slice(0, 10) ?? "");
  const [nextSurveyDue, setNextSurveyDue] = useState(initial?.nextSurveyDue?.slice(0, 10) ?? "");
  const [primaryVentilation, setPrimaryVentilation] = useState(initial?.primaryVentilation ?? false);
  const [status, setStatus] = useState<FanStatus>(initial?.status ?? "RUNNING");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const siteZones = zones.filter((z) => z.siteId === siteId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        siteId,
        zoneId: zoneId || null,
        identifier,
        fanType,
        location: location || undefined,
        manufacturer: manufacturer || undefined,
        serialNumber: serialNumber || undefined,
        dutyQuantityM3s: dutyQuantityM3s ? Number(dutyQuantityM3s) : null,
        dutyPressurePa: dutyPressurePa ? Number(dutyPressurePa) : null,
        motorKw: motorKw ? Number(motorKw) : null,
        installedDate: installedDate || null,
        nextSurveyDue: nextSurveyDue || null,
        primaryVentilation,
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
          <label className={labelClass}>{t("ventilationRegisters.fans.identifier")}</label>
          <input className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.fanType")}</label>
          <select className={selectClass} value={fanType} onChange={(e) => setFanType(e.target.value as FanType)}>
            {fanTypes.map((v) => <option key={v} value={v}>{t(`ventilationRegisters.fans.types.${v}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("common.site")}</label>
          <select className={selectClass} value={siteId} onChange={(e) => { setSiteId(e.target.value); setZoneId(""); }} required>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("common.zone")}</label>
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">{t("ventilationRegisters.fans.noZone")}</option>
            {siteZones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.location")}</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3 bg-mine-900/40 border border-mine-800 rounded-xl p-4">
        <div className="text-xs font-semibold text-mine-300">{t("ventilationRegisters.fans.dutySectionTitle")}</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>{t("ventilationRegisters.fans.dutyQuantity")}</label>
            <input className={inputClass} type="number" min={0} step="0.01" value={dutyQuantityM3s} onChange={(e) => setDutyQuantityM3s(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("ventilationRegisters.fans.dutyPressure")}</label>
            <input className={inputClass} type="number" step="1" value={dutyPressurePa} onChange={(e) => setDutyPressurePa(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("ventilationRegisters.fans.motorKw")}</label>
            <input className={inputClass} type="number" min={0} step="0.1" value={motorKw} onChange={(e) => setMotorKw(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-mine-400">{t("ventilationRegisters.fans.dutyHint")}</p>
      </div>

      <label className="flex items-start gap-2 text-sm text-mine-200">
        <input type="checkbox" className="mt-1" checked={primaryVentilation} onChange={(e) => setPrimaryVentilation(e.target.checked)} />
        <span>
          {t("ventilationRegisters.fans.primaryVentilation")}
          <span className="block text-[11px] text-mine-400">{t("ventilationRegisters.fans.primaryVentilationHint")}</span>
        </span>
      </label>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.installedDate")}</label>
          <DateField value={installedDate} onChange={setInstalledDate} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.nextSurveyDue")}</label>
          <DateField value={nextSurveyDue} onChange={setNextSurveyDue} />
        </div>
        <div>
          <label className={labelClass}>{t("common.status")}</label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as FanStatus)}>
            {fanStatuses.map((s) => <option key={s} value={s}>{t(`ventilationRegisters.fans.statuses.${s}`)}</option>)}
          </select>
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

function SurveyForm({ fan, onSubmit, onCancel }: { fan: VentilationFan; onSubmit: (d: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().slice(0, 10));
  const [measuredQuantityM3s, setMeasuredQuantityM3s] = useState("");
  const [measuredPressurePa, setMeasuredPressurePa] = useState("");
  const [motorAmps, setMotorAmps] = useState("");
  const [surveyedByName, setSurveyedByName] = useState("");
  const [findings, setFindings] = useState("");
  const [nextSurveyDue, setNextSurveyDue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const shortfall =
    fan.dutyQuantityM3s != null && measuredQuantityM3s !== "" && Number(measuredQuantityM3s) < fan.dutyQuantityM3s;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        surveyDate,
        measuredQuantityM3s: measuredQuantityM3s ? Number(measuredQuantityM3s) : null,
        measuredPressurePa: measuredPressurePa ? Number(measuredPressurePa) : null,
        motorAmps: motorAmps ? Number(motorAmps) : null,
        surveyedByName,
        findings: findings || undefined,
        nextSurveyDue: nextSurveyDue || null,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">
        {fan.dutyQuantityM3s != null
          ? t("ventilationRegisters.fans.surveyHintWithDuty", { identifier: fan.identifier, duty: fan.dutyQuantityM3s })
          : t("ventilationRegisters.fans.surveyHintNoDuty", { identifier: fan.identifier })}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.surveyDate")}</label>
          <DateField value={surveyDate} onChange={setSurveyDate} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.surveyedBy")}</label>
          <input className={inputClass} value={surveyedByName} onChange={(e) => setSurveyedByName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.measuredQuantity")}</label>
          <input className={inputClass} type="number" min={0} step="0.01" value={measuredQuantityM3s} onChange={(e) => setMeasuredQuantityM3s(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.measuredPressure")}</label>
          <input className={inputClass} type="number" step="1" value={measuredPressurePa} onChange={(e) => setMeasuredPressurePa(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.motorAmps")}</label>
          <input className={inputClass} type="number" min={0} step="0.1" value={motorAmps} onChange={(e) => setMotorAmps(e.target.value)} />
        </div>
      </div>
      {shortfall && <p className="text-xs text-danger-500">{t("ventilationRegisters.fans.belowDutyWarning")}</p>}
      <div>
        <label className={labelClass}>{t("ventilationRegisters.findings")}</label>
        <textarea className={inputClass} rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>{t("ventilationRegisters.fans.nextSurveyDue")}</label>
        <DateField value={nextSurveyDue} onChange={setNextSurveyDue} />
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

function StoppageForm({ fan, onSubmit, onCancel }: { fan: VentilationFan; onSubmit: (d: any) => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 10));
  const [endedAt, setEndedAt] = useState("");
  const [reason, setReason] = useState<FanStoppageReason>("BREAKDOWN");
  const [personsWithdrawn, setPersonsWithdrawn] = useState(false);
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [reportedToRegulator, setReportedToRegulator] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        startedAt,
        endedAt: endedAt || null,
        reason,
        personsWithdrawn,
        withdrawalNote: withdrawalNote || undefined,
        reportedToRegulator,
        notes: notes || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-mine-400">{t("ventilationRegisters.fans.stoppageHint", { identifier: fan.identifier })}</p>
      {fan.primaryVentilation && (
        <p className="text-xs text-danger-500">{t("ventilationRegisters.fans.primaryStoppageWarning")}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.startedAt")}</label>
          <DateField value={startedAt} onChange={setStartedAt} />
        </div>
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.endedAt")}</label>
          <DateField value={endedAt} onChange={setEndedAt} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("ventilationRegisters.fans.reason")}</label>
        <select className={selectClass} value={reason} onChange={(e) => setReason(e.target.value as FanStoppageReason)}>
          {stoppageReasons.map((r) => <option key={r} value={r}>{t(`ventilationRegisters.fans.stoppageReasons.${r}`)}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-mine-200">
        <input type="checkbox" checked={personsWithdrawn} onChange={(e) => setPersonsWithdrawn(e.target.checked)} />
        {t("ventilationRegisters.fans.personsWithdrawn")}
      </label>
      {personsWithdrawn && (
        <div>
          <label className={labelClass}>{t("ventilationRegisters.fans.withdrawalNote")}</label>
          <textarea className={inputClass} rows={2} value={withdrawalNote} onChange={(e) => setWithdrawalNote(e.target.value)} />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-mine-200">
        <input type="checkbox" checked={reportedToRegulator} onChange={(e) => setReportedToRegulator(e.target.checked)} />
        {t("ventilationRegisters.fans.reportedToRegulator")}
      </label>
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

export default function FanRegisterTab({ sites, zones }: { sites: Site[]; zones: Zone[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "EXECUTIVE";
  const canDelete = user?.role === "ADMIN" || user?.role === "EXECUTIVE";
  const [fans, setFans] = useState<VentilationFan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formModal, setFormModal] = useState<null | "create" | VentilationFan>(null);
  const [surveyModal, setSurveyModal] = useState<VentilationFan | null>(null);
  const [stoppageModal, setStoppageModal] = useState<VentilationFan | null>(null);
  const [historyFor, setHistoryFor] = useState<VentilationFan | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<VentilationFan[]>("/ventilation-fans");
      setFans(res.data);
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
    const live = fans.filter((f) => f.status !== "DECOMMISSIONED");
    const primary = live.filter((f) => f.primaryVentilation);
    const primaryStopped = primary.filter((f) => f.status === "STOPPED").length;
    const surveyOverdue = live.filter((f) => isOverdue(f.nextSurveyDue) || !f.nextSurveyDue).length;
    const belowDuty = live.filter((f) => f.surveys?.[0] && !f.surveys[0].meetsDuty).length;
    return { live: live.length, primary: primary.length, primaryStopped, surveyOverdue, belowDuty };
  }, [fans]);

  async function create(data: any) { await api.post("/ventilation-fans", data); setFormModal(null); await load(); }
  async function update(id: string, data: any) { await api.put(`/ventilation-fans/${id}`, data); setFormModal(null); await load(); }
  async function remove(id: string) {
    if (!confirm(t("ventilationRegisters.fans.confirmDelete"))) return;
    await api.delete(`/ventilation-fans/${id}`);
    await load();
  }
  async function logSurvey(id: string, data: any) { await api.post(`/ventilation-fans/${id}/surveys`, data); setSurveyModal(null); await load(); }
  async function logStoppage(id: string, data: any) { await api.post(`/ventilation-fans/${id}/stoppages`, data); setStoppageModal(null); await load(); }

  if (loading) return <div className="text-mine-300">{t("common.loading")}</div>;
  if (loadError) return <LoadError onRetry={load} />;

  const columns: DataTableColumn<VentilationFan>[] = [
    {
      key: "identifier",
      header: t("ventilationRegisters.fans.identifier"),
      render: (f) => (
        <span>
          {f.identifier}
          {f.primaryVentilation && <span className="ml-2 text-[10px] font-semibold text-hazard-500">{t("ventilationRegisters.fans.primaryShort")}</span>}
        </span>
      ),
      sortValue: (f) => f.identifier,
    },
    { key: "fanType", header: t("common.type"), render: (f) => t(`ventilationRegisters.fans.types.${f.fanType}`), sortValue: (f) => f.fanType },
    { key: "site", header: t("common.site"), render: (f) => `${f.site?.name ?? "—"}${f.zone ? ` · ${f.zone.name}` : ""}`, sortValue: (f) => f.site?.name ?? "" },
    {
      key: "duty",
      header: t("ventilationRegisters.fans.dutyShort"),
      render: (f) => (f.dutyQuantityM3s != null ? `${f.dutyQuantityM3s} m³/s` : <span className="text-hazard-500">{t("ventilationRegisters.notSet")}</span>),
      sortValue: (f) => f.dutyQuantityM3s ?? -1,
    },
    {
      key: "lastSurvey",
      header: t("ventilationRegisters.fans.lastSurveyShort"),
      render: (f) => {
        const last = f.surveys?.[0];
        if (!last) return <span className="text-hazard-500">{t("ventilationRegisters.fans.neverSurveyed")}</span>;
        return (
          <span className={last.meetsDuty ? "text-mine-200" : "text-danger-500 font-semibold"}>
            {last.measuredQuantityM3s != null ? `${last.measuredQuantityM3s} m³/s` : new Date(last.surveyDate).toLocaleDateString()}
          </span>
        );
      },
      sortValue: (f) => f.surveys?.[0]?.surveyDate ?? "",
    },
    { key: "nextSurveyDue", header: t("ventilationRegisters.fans.nextSurveyDue"), render: (f) => <DueDate value={f.nextSurveyDue} />, sortValue: (f) => f.nextSurveyDue ?? "9999" },
    { key: "status", header: t("common.status"), render: (f) => <StatusBadge status={f.status} />, sortValue: (f) => f.status },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label={t("ventilationRegisters.fans.statPrimaryStopped")}
          value={stats.primaryStopped}
          target={t("ventilationRegisters.fans.statPrimaryStoppedTarget", { count: stats.primary })}
          tone={stats.primaryStopped === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("ventilationRegisters.fans.statBelowDuty")}
          value={stats.belowDuty}
          target={t("ventilationRegisters.targetZero")}
          tone={stats.belowDuty === 0 ? "good" : "bad"}
        />
        <StatTile
          label={t("ventilationRegisters.fans.statSurveyOverdue")}
          value={stats.surveyOverdue}
          target={t("ventilationRegisters.targetZero")}
          tone={stats.surveyOverdue === 0 ? "good" : "warn"}
        />
        <StatTile label={t("ventilationRegisters.fans.statLive")} value={stats.live} target={t("ventilationRegisters.fans.statLiveTarget")} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-mine-200">{t("ventilationRegisters.fans.registerTitle")}</h2>
            <p className="text-xs text-mine-400">{t("ventilationRegisters.fans.registerHint")}</p>
          </div>
          {canEdit && <button className={buttonPrimary} onClick={() => setFormModal("create")} disabled={sites.length === 0}>{t("ventilationRegisters.fans.newFan")}</button>}
        </div>
        <DataTable
          columns={columns}
          rows={fans}
          rowKey={(f) => f.id}
          emptyMessage={t("ventilationRegisters.fans.noneYet")}
          searchValue={(f) => `${f.identifier} ${f.location ?? ""} ${f.serialNumber ?? ""}`}
          exportFilename="ventilation-fans"
          exportColumns={[
            { header: t("ventilationRegisters.fans.identifier"), value: (f) => f.identifier },
            { header: t("common.type"), value: (f) => f.fanType },
            { header: t("common.site"), value: (f) => f.site?.name ?? "" },
            { header: t("ventilationRegisters.fans.dutyShort"), value: (f) => (f.dutyQuantityM3s != null ? String(f.dutyQuantityM3s) : "") },
            { header: t("common.status"), value: (f) => f.status },
          ]}
          actions={(f) => (
            <div className="flex justify-end gap-2">
              <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setHistoryFor(f)}>{t("ventilationRegisters.history")}</button>
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setSurveyModal(f)}>{t("ventilationRegisters.fans.logSurvey")}</button>}
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setStoppageModal(f)}>{t("ventilationRegisters.fans.logStoppage")}</button>}
              {canEdit && <button className="text-xs text-mine-300 hover:text-mine-50" onClick={() => setFormModal(f)}>{t("common.edit")}</button>}
              {canDelete && <button className={buttonDanger} onClick={() => remove(f.id)}>{t("common.delete")}</button>}
            </div>
          )}
        />
      </div>

      {formModal && (
        <Modal title={formModal === "create" ? t("ventilationRegisters.fans.newFanTitle") : t("ventilationRegisters.fans.editFanTitle")} onClose={() => setFormModal(null)}>
          <FanForm
            sites={sites}
            zones={zones}
            initial={formModal === "create" ? undefined : formModal}
            onSubmit={(data) => (formModal === "create" ? create(data) : update(formModal.id, data))}
            onCancel={() => setFormModal(null)}
          />
        </Modal>
      )}

      {surveyModal && (
        <Modal title={t("ventilationRegisters.fans.logSurvey")} onClose={() => setSurveyModal(null)}>
          <SurveyForm fan={surveyModal} onSubmit={(d) => logSurvey(surveyModal.id, d)} onCancel={() => setSurveyModal(null)} />
        </Modal>
      )}

      {stoppageModal && (
        <Modal title={t("ventilationRegisters.fans.logStoppage")} onClose={() => setStoppageModal(null)}>
          <StoppageForm fan={stoppageModal} onSubmit={(d) => logStoppage(stoppageModal.id, d)} onCancel={() => setStoppageModal(null)} />
        </Modal>
      )}

      {historyFor && (
        <Modal title={t("ventilationRegisters.historyTitle", { identifier: historyFor.identifier })} onClose={() => setHistoryFor(null)}>
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-mine-300 uppercase tracking-wider mb-2">{t("ventilationRegisters.fans.surveys")}</h3>
              {historyFor.surveys && historyFor.surveys.length > 0 ? (
                <ul className="space-y-3">
                  {historyFor.surveys.map((s) => (
                    <li key={s.id} className="border-b border-mine-800 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-mine-100">{new Date(s.surveyDate).toLocaleDateString()}</span>
                        <StatusBadge status={s.meetsDuty ? "PASS" : "FAIL"} />
                      </div>
                      <p className="text-xs text-mine-400">
                        {s.surveyedByName}
                        {s.measuredQuantityM3s != null ? ` · ${s.measuredQuantityM3s} m³/s` : ""}
                        {s.measuredPressurePa != null ? ` · ${s.measuredPressurePa} Pa` : ""}
                      </p>
                      {s.findings && <p className="text-xs text-hazard-500 mt-1">{s.findings}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mine-400">{t("ventilationRegisters.fans.noSurveysYet")}</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-mine-300 uppercase tracking-wider mb-2">{t("ventilationRegisters.fans.stoppages")}</h3>
              {historyFor.stoppages && historyFor.stoppages.length > 0 ? (
                <ul className="space-y-3">
                  {historyFor.stoppages.map((s) => (
                    <li key={s.id} className="border-b border-mine-800 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-mine-100">{t(`ventilationRegisters.fans.stoppageReasons.${s.reason}`)}</span>
                        {s.personsWithdrawn && <span className="text-[10px] font-semibold text-danger-500">{t("ventilationRegisters.fans.withdrawnShort")}</span>}
                      </div>
                      <p className="text-xs text-mine-400">
                        {new Date(s.startedAt).toLocaleDateString()}
                        {s.endedAt ? ` – ${new Date(s.endedAt).toLocaleDateString()}` : ` · ${t("ventilationRegisters.fans.ongoing")}`}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mine-400">{t("ventilationRegisters.fans.noStoppagesYet")}</p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
